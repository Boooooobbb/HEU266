/**
 * 生成随机用户并输出匹配测试报告（Markdown）
 *
 * 用法示例：
 *   deno run --allow-write --allow-read docs/edge-functions/matching/generate_random_test_report.ts --users 100 --seed 20260508
 */

import {
  checkGenderConstraint,
  checkStageConstraint,
  checkModule2Bottomlines,
  calculateMatchScore,
} from "./scoreCalculator.ts";
import { buildScoreMatrix, groupUsersByPreference } from "./galeShapley.ts";
import { batchMatch } from "./hungarian.ts";
import {
  CandidateUser,
  QuestionnaireAnswers,
  Module1Answers,
  Module2Answers,
  Module3Answers,
  Module4Answers,
  Module5Answers,
  MatchScore,
  MIN_SCORE_THRESHOLD,
  MAX_MATCHES_PER_USER,
} from "./types.ts";

type SeededRng = () => number; // [0,1)

function mulberry32(seed: number): SeededRng {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function toInt(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

// ============ 随机数据生成器（带 seed） ============

const GENDERS = ["male", "female"] as const;
const EXPECTED_GENDERS = ["male", "female", "both"] as const;
const STAGES = ["undergrad_low", "undergrad_high", "master", "doctor"] as const;
const SCHEDULES = ["early", "flexible", "night"] as const;
const SPACES = ["neat", "chaotic", "casual"] as const;
const FREQUENCIES = ["high", "normal", "low"] as const;
const SMOKING = ["never", "sometimes", "often"] as const;
const ALCOHOL = ["never", "sometimes", "often"] as const;
const ATTITUDES = ["A", "B", "C"] as const;
const PREFERENCES = ["similar", "complement", "natural"] as const;
const MONEY_VALUES = ["save", "balance", "enjoy"] as const;
const FUTURE_PLANS = ["clear", "flow", "explore"] as const;
const PRESSURE_CHOICES = ["task", "balance", "love"] as const;
const RISK_PREFERENCES = ["stable", "weigh", "adventure"] as const;
const RELATION_STYLES = ["clear", "flex", "emotion"] as const;
const WEEKEND_STYLES = ["improve", "balance", "relax"] as const;
const ATTACHMENTS = ["secure", "anxious", "avoidant"] as const;
const SPACE_PREFERENCES = ["boundary", "merge", "balance"] as const;
const SUPPORTS = ["listen", "analysis", "distract", "alone"] as const;
const SECURITIES = ["certainty", "tolerance", "social", "boundary"] as const;
const CONSUMPTIONS = ["communication", "emotion", "imbalance", "compress"] as const;
const LOCATIONS = ["图书馆", "食堂", "体育馆", "咖啡厅", "实验室", "宿舍", "电影院", "酒吧", "公园", "超市"] as const;
const LOVE_LANGUAGES = ["physical", "words", "time", "gift", "service"] as const;
const CORE_FEELINGS = ["safe", "excited", "grateful", "adventurous", "calm"] as const;

function randomChoice<T>(rng: SeededRng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomInt(rng: SeededRng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomSubset<T>(rng: SeededRng, arr: readonly T[], min: number, max: number): T[] {
  const count = min + Math.floor(rng() * (max - min + 1));
  const copy = [...arr];
  // Fisher–Yates shuffle (seeded)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function generateModule1(rng: SeededRng, userId: string): Module1Answers {
  const gender = randomChoice(rng, GENDERS);
  const expectedGender = randomChoice(rng, EXPECTED_GENDERS);

  const stage = randomChoice(rng, STAGES);
  let partnerStages: string[];

  if (rng() < 0.3) {
    partnerStages = ["both"];
  } else {
    const stageIndex = STAGES.indexOf(stage);
    const count = randomInt(rng, 1, Math.min(3, STAGES.length - stageIndex));
    partnerStages = STAGES.slice(stageIndex, stageIndex + count);
  }

  return {
    gender,
    expectedGender,
    stage,
    partnerStages,
    locations: randomSubset(rng, LOCATIONS, 1, 4),
  };
}

function generateModule2(rng: SeededRng): Module2Answers {
  return {
    q1Schedule: randomChoice(rng, SCHEDULES),
    q1Attitude: randomChoice(rng, ATTITUDES),
    q2Space: randomChoice(rng, SPACES),
    q2Tolerance: randomChoice(rng, ATTITUDES),
    q3Frequency: randomChoice(rng, FREQUENCIES),
    q3Bottomline: randomChoice(rng, ATTITUDES),
    q4Smoking: randomChoice(rng, SMOKING),
    q4Bottomline: randomChoice(rng, ATTITUDES),
    q5Alcohol: randomChoice(rng, ALCOHOL),
    q5Bottomline: randomChoice(rng, ATTITUDES),
  };
}

function generateModule3(rng: SeededRng): Module3Answers {
  return {
    q1Slider: randomInt(rng, 0, 4), q1Preference: randomChoice(rng, PREFERENCES),
    q2Slider: randomInt(rng, 0, 4), q2Preference: randomChoice(rng, PREFERENCES),
    q3Slider: randomInt(rng, 0, 4), q3Preference: randomChoice(rng, PREFERENCES),
    q4Slider: randomInt(rng, 0, 4), q4Preference: randomChoice(rng, PREFERENCES),
    q5Slider: randomInt(rng, 0, 4), q5Preference: randomChoice(rng, PREFERENCES),
    q6Slider: randomInt(rng, 0, 4), q6Preference: randomChoice(rng, PREFERENCES),
    q7Slider: randomInt(rng, 0, 4), q7Preference: randomChoice(rng, PREFERENCES),
    q8Slider: randomInt(rng, 0, 4), q8Preference: randomChoice(rng, PREFERENCES),
    q9Slider: randomInt(rng, 0, 4), q9Preference: randomChoice(rng, PREFERENCES),
    q10Slider: randomInt(rng, 0, 4), q10Preference: randomChoice(rng, PREFERENCES),
  };
}

function generateModule4(rng: SeededRng): Module4Answers {
  return {
    q1: randomChoice(rng, MONEY_VALUES),
    q2: randomChoice(rng, FUTURE_PLANS),
    q3: randomChoice(rng, PRESSURE_CHOICES),
    q4: randomChoice(rng, RISK_PREFERENCES),
    q5: randomChoice(rng, RELATION_STYLES),
    q6: randomChoice(rng, WEEKEND_STYLES),
  };
}

function generateModule5(rng: SeededRng): Module5Answers {
  return {
    q1: randomChoice(rng, ATTACHMENTS),
    q2: randomSubset(rng, LOVE_LANGUAGES, 1, 3),
    q3: randomChoice(rng, SPACE_PREFERENCES),
    q4: randomChoice(rng, SUPPORTS),
    q5: randomChoice(rng, SECURITIES),
    q6: randomChoice(rng, CONSUMPTIONS),
    q7: randomSubset(rng, CORE_FEELINGS, 1, 3),
  };
}

function generateCandidateUser(rng: SeededRng, id: string): CandidateUser {
  const module1 = generateModule1(rng, id);

  const profile = {
    id,
    gender: module1.gender as "male" | "female",
    stage: module1.stage,
    expected_gender: module1.expectedGender,
    partner_stages: module1.partnerStages,
    locations: module1.locations,
  };

  const questionnaire: QuestionnaireAnswers = {
    module1,
    module2: generateModule2(rng),
    module3: generateModule3(rng),
    module4: generateModule4(rng),
    module5: generateModule5(rng),
  };

  return {
    id,
    profile,
    questionnaire,
    matchState: {
      preferences: [],
      receivedOffers: new Map(),
      matchedUsers: [],
      rejectedOffers: new Set(),
    },
  };
}

function scoreToBucket(score: number): string {
  if (score === 0) return "0";
  if (score < 10) return "1-9";
  if (score < 20) return "10-19";
  if (score < 30) return "20-29";
  if (score < 40) return "30-39";
  if (score < 50) return "40-49";
  if (score < 60) return "50-59";
  if (score < 70) return "60-69";
  if (score < 80) return "70-79";
  if (score < 90) return "80-89";
  return "90-100";
}

function scoreBucketsTemplate(): Record<string, number> {
  return {
    "0": 0,
    "1-9": 0,
    "10-19": 0,
    "20-29": 0,
    "30-39": 0,
    "40-49": 0,
    "50-59": 0,
    "60-69": 0,
    "70-79": 0,
    "80-89": 0,
    "90-100": 0,
  };
}

function uniquePairsFromMatrix(users: CandidateUser[], matrix: Map<string, Map<string, MatchScore>>): number[] {
  const ids = users.map((u) => u.id);
  const scores: number[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const ab = matrix.get(a)?.get(b)?.total ?? 0;
      const ba = matrix.get(b)?.get(a)?.total ?? 0;
      // 取双向均值作为“无向配对”的代表分数（如某方向缺失则按 0 计）
      scores.push((ab + ba) / 2);
    }
  }

  return scores;
}

function countBottomlineAndConstraints(users: CandidateUser[], rng: SeededRng, samples: number): {
  sampledPairs: number;
  genderFail: number;
  stageFail: number;
  bottomlineTouched: number;
  absoluteRedline: number;
} {
  if (users.length < 2) {
    return { sampledPairs: 0, genderFail: 0, stageFail: 0, bottomlineTouched: 0, absoluteRedline: 0 };
  }

  let genderFail = 0;
  let stageFail = 0;
  let bottomlineTouched = 0;
  let absoluteRedline = 0;

  const pickIndex = () => Math.floor(rng() * users.length);

  let tries = 0;
  let sampled = 0;
  while (sampled < samples && tries < samples * 10) {
    tries++;
    let i = pickIndex();
    let j = pickIndex();
    if (j === i) continue;
    if (j < i) {
      const tmp = i;
      i = j;
      j = tmp;
    }

    const a = users[i];
    const b = users[j];

    const mod1a = a.questionnaire.module1;
    const mod1b = b.questionnaire.module1;
    if (!checkGenderConstraint(mod1a, mod1b)) genderFail++;
    if (!checkStageConstraint(mod1a, mod1b)) stageFail++;

    const mod2a = a.questionnaire.module2;
    const mod2b = b.questionnaire.module2;
    const violations = checkModule2Bottomlines(mod2a, mod2b);
    if (violations.length > 0) {
      bottomlineTouched++;
      if (violations.some((v) => v.penalty >= 1.0)) absoluteRedline++;
    }

    sampled++;
  }

  return { sampledPairs: sampled, genderFail, stageFail, bottomlineTouched, absoluteRedline };
}

async function main() {
  const args = parseArgs(Deno.args);
  const userCount = Math.max(2, toInt(args.users, 100));
  const seed = toInt(args.seed, 20260508);
  const threshold = toInt(args.threshold, MIN_SCORE_THRESHOLD);

  const now = new Date();
  const runId = `${todayYmd(now)}-seed${seed}-n${userCount}`;
  const outPath = typeof args.out === "string"
    ? args.out
    : `docs/test-reports/matching/random-${runId}.md`;

  const rng = mulberry32(seed);

  const t0 = performance.now();
  const users: CandidateUser[] = [];
  for (let i = 1; i <= userCount; i++) {
    users.push(generateCandidateUser(rng, `user_${i}`));
  }
  const tGen = performance.now();

  const scoreMatrix = buildScoreMatrix(users, (a, b) =>
    calculateMatchScore(a.profile, b.profile, a.questionnaire, b.questionnaire)
  );
  const tMatrix = performance.now();

  const groups = groupUsersByPreference(users);

  // 主池：男(期望女) × 女(期望男)，优先 Hungarian
  const tPrimary0 = performance.now();
  const primaryPairs = batchMatch(
    groups.malePreferFemale,
    groups.femalePreferMale,
    scoreMatrix,
    { useHungarianFirst: true, maxMatchesPerUser: 1, minScoreThreshold: threshold }
  );
  const tPrimary1 = performance.now();

  // bothPool：同池，禁用 Hungarian（避免双向重复/同人多次），只走 greedy 补齐
  const tBoth0 = performance.now();
  const bothPairs = batchMatch(
    groups.bothPool,
    groups.bothPool,
    scoreMatrix,
    { useHungarianFirst: false, maxMatchesPerUser: 1, minScoreThreshold: threshold }
  );
  const tBoth1 = performance.now();

  const allPairs = [...primaryPairs, ...bothPairs];

  // 匹配覆盖率
  const matchedUsers = new Set<string>();
  for (const p of allPairs) {
    matchedUsers.add(p.leftId);
    matchedUsers.add(p.rightId);
  }
  const unmatchedCount = userCount - matchedUsers.size;

  // 无向配对分数统计（双向均值）
  const undirectedScores = uniquePairsFromMatrix(users, scoreMatrix);
  const undirectedSorted = [...undirectedScores].sort((a, b) => a - b);
  const undirectedBuckets = scoreBucketsTemplate();
  for (const s of undirectedScores) {
    undirectedBuckets[scoreToBucket(s)]++;
  }

  // 匹配对分数统计
  const matchScores = allPairs.map((p) => p.score).sort((a, b) => a - b);
  const matchAvg = matchScores.length ? matchScores.reduce((a, b) => a + b, 0) / matchScores.length : 0;

  // 采样约束/避雷触发率
  const sampleStats = countBottomlineAndConstraints(users, rng, 300);

  // top matches
  const topPairs = [...allPairs].sort((a, b) => b.score - a.score).slice(0, 10);

  const t1 = performance.now();

  const maleCount = users.filter((u) => u.profile.gender === "male").length;
  const femaleCount = users.filter((u) => u.profile.gender === "female").length;

  const report = `# 随机用户匹配测试报告（100人级）\n\n` +
`- 生成日期：${now.toISOString()}\n` +
`- 运行标识：${runId}\n` +
`- 随机种子：${seed}\n` +
`- 用户数：${userCount}\n` +
`- 评分标尺：0-100（total 与各维度）\n` +
`- 过滤阈值：${threshold}\n` +
`- 每人最多配对：${MAX_MATCHES_PER_USER}\n` +
`\n` +
`## 用户分布\n\n` +
`- 性别：male=${maleCount}，female=${femaleCount}\n` +
`- 偏好分组：male→female=${groups.malePreferFemale.length}，female→male=${groups.femalePreferMale.length}，bothPool=${groups.bothPool.length}\n` +
`\n` +
`## 性能（本机一次运行）\n\n` +
`- 生成用户：${Math.round(tGen - t0)}ms\n` +
`- 构建分数矩阵：${Math.round(tMatrix - tGen)}ms\n` +
`- 主池匹配（Hungarian+Greedy）：${Math.round(tPrimary1 - tPrimary0)}ms\n` +
`- bothPool 匹配（Greedy）：${Math.round(tBoth1 - tBoth0)}ms\n` +
`- 总耗时：${Math.round(t1 - t0)}ms\n` +
`\n` +
`## 配对分数（无向：AB/BA均值）\n\n` +
`- 样本量：${undirectedScores.length}（C(${userCount},2)）\n` +
`- 平均分：${round2(undirectedScores.reduce((a, b) => a + b, 0) / Math.max(1, undirectedScores.length))}\n` +
`- P50 / P75 / P90：${round2(percentile(undirectedSorted, 0.5))} / ${round2(percentile(undirectedSorted, 0.75))} / ${round2(percentile(undirectedSorted, 0.9))}\n` +
`- 最高 / 最低：${round2(undirectedSorted[undirectedSorted.length - 1] ?? 0)} / ${round2(undirectedSorted.find((x) => x > 0) ?? 0)}\n` +
`\n` +
`### 分布（bucket）\n\n` +
Object.entries(undirectedBuckets)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") +
`\n\n` +
`## 匹配结果（与调度逻辑一致）\n\n` +
`- 主池匹配数：${primaryPairs.length}\n` +
`- bothPool 匹配数：${bothPairs.length}\n` +
`- 总匹配数：${allPairs.length}\n` +
`- 被匹配到的用户数：${matchedUsers.size}/${userCount}\n` +
`- 未匹配用户数：${unmatchedCount}\n` +
`\n` +
`### 匹配分数\n\n` +
`- 平均：${round2(matchAvg)}\n` +
`- P50 / P75 / P90：${round2(percentile(matchScores, 0.5))} / ${round2(percentile(matchScores, 0.75))} / ${round2(percentile(matchScores, 0.9))}\n` +
`- 最高 / 最低：${round2(matchScores[matchScores.length - 1] ?? 0)} / ${round2(matchScores[0] ?? 0)}\n` +
`\n` +
`### Top 10 匹配对\n\n` +
(topPairs.length
  ? topPairs.map((p, idx) => `- #${idx + 1}: ${p.leftId} - ${p.rightId} = ${round2(p.score)}`).join("\n")
  : "- （无）") +
`\n\n` +
`## 约束/避雷抽样（随机采样）\n\n` +
`- 抽样配对数：${sampleStats.sampledPairs}\n` +
`- 性别约束失败：${sampleStats.genderFail}\n` +
`- 学段约束失败：${sampleStats.stageFail}\n` +
`- 触犯底线（任意）：${sampleStats.bottomlineTouched}\n` +
`- 触犯绝对红线（penalty>=1.0）：${sampleStats.absoluteRedline}\n`;

  await Deno.mkdir("docs/test-reports/matching", { recursive: true });
  await Deno.writeTextFile(outPath, report);

  console.log(`Report written to: ${outPath}`);
}

if (import.meta.main) {
  await main();
}
