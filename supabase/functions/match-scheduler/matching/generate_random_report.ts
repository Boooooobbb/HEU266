/**
 * Random matching smoke-test + report generator.
 *
 * Usage:
 *   deno run --allow-read --allow-write docs/edge-functions/matching/generate_random_report.ts --n=100 --seed=20260508
 *   deno run --allow-read --allow-write docs/edge-functions/matching/generate_random_report.ts --n=3000 --seed=20260508 --no-sample
 */

import { batchMatch } from "./hungarian.ts";
import { buildScoreMatrix, groupUsersByPreference } from "./galeShapley.ts";
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
} from "./types.ts";
import { calculateMatchScore } from "./scoreCalculator.ts";

// -------------------- args --------------------

type Args = { n: number; seed: number; noSample: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { n: 100, seed: 20260508, noSample: false };

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    if (raw === "--no-sample" || raw === "--noSample") {
      args.noSample = true;
      continue;
    }

    const [k, v] = raw.slice(2).split("=");
    if (!k || v == null) continue;

    if (k === "n") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 2 && n <= 20000) args.n = Math.floor(n);
    }
    if (k === "seed") {
      const seed = Number(v);
      if (Number.isFinite(seed) && seed >= 0) args.seed = Math.floor(seed);
    }

    if (k === "no-sample" || k === "noSample") {
      args.noSample = v === "1" || v.toLowerCase() === "true";
    }
  }

  return args;
}

// -------------------- seeded rng --------------------

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function choice<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function subset<T>(rng: () => number, arr: readonly T[], min: number, max: number): T[] {
  const count = randInt(rng, min, max);
  const copy = [...arr];
  // Fisher–Yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

// -------------------- random data --------------------

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

function generateModule1(rng: () => number): Module1Answers {
  const gender = choice(rng, GENDERS);
  const expectedGender = choice(rng, EXPECTED_GENDERS);
  const stage = choice(rng, STAGES);

  let partnerStages: string[];
  if (rng() < 0.3) {
    partnerStages = ["both"];
  } else {
    const stageIndex = STAGES.indexOf(stage);
    const count = randInt(rng, 1, Math.min(3, STAGES.length - stageIndex));
    partnerStages = STAGES.slice(stageIndex, stageIndex + count);
  }

  return {
    gender,
    expectedGender,
    stage,
    partnerStages,
    locations: subset(rng, LOCATIONS, 1, 4),
  };
}

function generateModule2(rng: () => number): Module2Answers {
  return {
    q1Schedule: choice(rng, SCHEDULES),
    q1Attitude: choice(rng, ATTITUDES),
    q2Space: choice(rng, SPACES),
    q2Tolerance: choice(rng, ATTITUDES),
    q3Frequency: choice(rng, FREQUENCIES),
    q3Bottomline: choice(rng, ATTITUDES),
    q4Smoking: choice(rng, SMOKING),
    q4Bottomline: choice(rng, ATTITUDES),
    q5Alcohol: choice(rng, ALCOHOL),
    q5Bottomline: choice(rng, ATTITUDES),
  };
}

function generateModule3(rng: () => number): Module3Answers {
  return {
    q1Slider: randInt(rng, 0, 4), q1Preference: choice(rng, PREFERENCES),
    q2Slider: randInt(rng, 0, 4), q2Preference: choice(rng, PREFERENCES),
    q3Slider: randInt(rng, 0, 4), q3Preference: choice(rng, PREFERENCES),
    q4Slider: randInt(rng, 0, 4), q4Preference: choice(rng, PREFERENCES),
    q5Slider: randInt(rng, 0, 4), q5Preference: choice(rng, PREFERENCES),
    q6Slider: randInt(rng, 0, 4), q6Preference: choice(rng, PREFERENCES),
    q7Slider: randInt(rng, 0, 4), q7Preference: choice(rng, PREFERENCES),
    q8Slider: randInt(rng, 0, 4), q8Preference: choice(rng, PREFERENCES),
    q9Slider: randInt(rng, 0, 4), q9Preference: choice(rng, PREFERENCES),
    q10Slider: randInt(rng, 0, 4), q10Preference: choice(rng, PREFERENCES),
  };
}

function generateModule4(rng: () => number): Module4Answers {
  return {
    q1: choice(rng, MONEY_VALUES),
    q2: choice(rng, FUTURE_PLANS),
    q3: choice(rng, PRESSURE_CHOICES),
    q4: choice(rng, RISK_PREFERENCES),
    q5: choice(rng, RELATION_STYLES),
    q6: choice(rng, WEEKEND_STYLES),
  };
}

function generateModule5(rng: () => number): Module5Answers {
  return {
    q1: choice(rng, ATTACHMENTS),
    q2: subset(rng, LOVE_LANGUAGES, 1, 3),
    q3: choice(rng, SPACE_PREFERENCES),
    q4: choice(rng, SUPPORTS),
    q5: choice(rng, SECURITIES),
    q6: choice(rng, CONSUMPTIONS),
    q7: subset(rng, CORE_FEELINGS, 1, 3),
  };
}

function generateCandidateUser(rng: () => number, id: string): CandidateUser {
  const module1 = generateModule1(rng);
  const questionnaire: QuestionnaireAnswers = {
    module1,
    module2: generateModule2(rng),
    module3: generateModule3(rng),
    module4: generateModule4(rng),
    module5: generateModule5(rng),
  };

  return {
    id,
    profile: {
      id,
      gender: module1.gender,
      stage: module1.stage,
      expected_gender: module1.expectedGender,
      partner_stages: module1.partnerStages,
      locations: module1.locations,
      questionnaire_completed: true,
    },
    questionnaire,
    matchState: {
      preferences: [],
      receivedOffers: new Map(),
      matchedUsers: [],
      rejectedOffers: new Set(),
    },
  };
}

// -------------------- metrics --------------------

type PairRow = {
  a: string;
  b: string;
  score: number;
  dims: MatchScore["dimensions"];
};

function formatJsonBlock(value: unknown): string {
  return `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
}

function dumpCandidate(user: CandidateUser): string {
  const q = user.questionnaire;
  return [
    `## ${user.id}`,
    `### profile`,
    formatJsonBlock(user.profile),
    `### module1`,
    formatJsonBlock(q.module1 ?? null),
    `### module2`,
    formatJsonBlock(q.module2 ?? null),
    `### module3`,
    formatJsonBlock(q.module3 ?? null),
    `### module4`,
    formatJsonBlock(q.module4 ?? null),
    `### module5`,
    formatJsonBlock(q.module5 ?? null),
  ].join("\n");
}

function histogram(scores: number[], bucketSize: number): { label: string; count: number }[] {
  const buckets = new Map<number, number>();
  for (const s of scores) {
    const b = Math.min(100 - bucketSize, Math.floor(s / bucketSize) * bucketSize);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const result: { label: string; count: number }[] = [];
  for (let b = 0; b <= 100 - bucketSize; b += bucketSize) {
    const from = b;
    const to = b + bucketSize;
    result.push({ label: `[${from}, ${to})`, count: buckets.get(b) ?? 0 });
  }
  return result;
}

function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function buildScoreMatrixWithProgress(
  candidates: CandidateUser[],
  calculateScore: (a: CandidateUser, b: CandidateUser) => MatchScore,
  logEveryRows: number
): Map<string, Map<string, MatchScore>> {
  const matrix = new Map<string, Map<string, MatchScore>>();
  const start = performance.now();

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const b = candidates[j];
      const score = calculateScore(a, b);
      if (score.total > 0) row.set(b.id, score);
    }
    matrix.set(a.id, row);

    if (logEveryRows > 0 && (i + 1) % logEveryRows === 0) {
      const elapsedMs = performance.now() - start;
      console.log(
        `[random-report] scoreMatrix progress ${(i + 1)}/${candidates.length} rows (${elapsedMs.toFixed(0)}ms)`
      );
    }
  }

  return matrix;
}

// -------------------- main --------------------

const { n, seed, noSample } = parseArgs(Deno.args);
const rng = mulberry32(seed);

const startedAt = new Date();
const yyyy = startedAt.getFullYear();
const mm = String(startedAt.getMonth() + 1).padStart(2, "0");
const dd = String(startedAt.getDate()).padStart(2, "0");
const dateTag = `${yyyy}-${mm}-${dd}`;

console.log(`[random-report] n=${n} seed=${seed} threshold=${MIN_SCORE_THRESHOLD}`);
console.log(`[random-report] start ${startedAt.toISOString()}`);

// 1) generate users
const genStart = performance.now();
const users: CandidateUser[] = [];
for (let i = 1; i <= n; i++) {
  users.push(generateCandidateUser(rng, `user_${i}`));
}
const genMs = performance.now() - genStart;
console.log(`[random-report] generated ${n} users in ${genMs.toFixed(1)}ms`);

const maleCount = users.filter((u) => u.profile.gender === "male").length;
const femaleCount = users.filter((u) => u.profile.gender === "female").length;
const expectedBothCount = users.filter((u) => u.profile.expected_gender === "both").length;

// 2) build score matrix
const matrixStart = performance.now();
const calculateScore = (a: CandidateUser, b: CandidateUser) =>
  calculateMatchScore(a.profile, b.profile, a.questionnaire, b.questionnaire);

const scoreMatrix =
  users.length >= 300
    ? buildScoreMatrixWithProgress(users, calculateScore, 50)
    : buildScoreMatrix(users, calculateScore);
const matrixMs = performance.now() - matrixStart;
console.log(`[random-report] built scoreMatrix in ${matrixMs.toFixed(1)}ms`);

// flatten scores (unique pairs)
const pairScores: PairRow[] = [];
const uniqueScores: number[] = [];
let totalDirectedEdges = 0;

for (const [a, row] of scoreMatrix.entries()) {
  totalDirectedEdges += row.size;
  for (const [b, score] of row.entries()) {
    if (a < b) {
      pairScores.push({ a, b, score: score.total, dims: score.dimensions });
      uniqueScores.push(score.total);
    }
  }
}

console.log(
  `[random-report] matrix edges (directed, score>0)=${totalDirectedEdges}, uniquePairs=${uniqueScores.length}`
);

pairScores.sort((x, y) => y.score - x.score);

const pass55 = uniqueScores.filter((s) => s >= MIN_SCORE_THRESHOLD).length;
const pass60 = uniqueScores.filter((s) => s >= 60).length;
const pass70 = uniqueScores.filter((s) => s >= 70).length;
const pass80 = uniqueScores.filter((s) => s >= 80).length;

const avgScore = uniqueScores.length ? uniqueScores.reduce((a, b) => a + b, 0) / uniqueScores.length : 0;
const minScore = uniqueScores.length ? Math.min(...uniqueScores) : 0;
const maxScore = uniqueScores.length ? Math.max(...uniqueScores) : 0;

// 3) run matching (same branching as scheduler)
const matchStart = performance.now();

let matchPairs: { leftId: string; rightId: string; score: number }[] = [];
let algorithm: string;

if (users.length <= 50) {
  // For this report, we focus on 100 users => batch path, but keep parity.
  algorithm = "gale-shapley";
  // Not running GS here to keep report aligned with scheduler branch by size.
  // (If needed later, we can add it.)
  matchPairs = [];
} else {
  algorithm = "hungarian+greedy";
  const groups = groupUsersByPreference(users);

  console.log(
    `[random-report] groups malePreferFemale=${groups.malePreferFemale.length}, femalePreferMale=${groups.femalePreferMale.length}, bothPool=${groups.bothPool.length}`
  );

  const primaryPairs = batchMatch(groups.malePreferFemale, groups.femalePreferMale, scoreMatrix, {
    useHungarianFirst: true,
    maxMatchesPerUser: 1,
    minScoreThreshold: MIN_SCORE_THRESHOLD,
  });

  const bothPairs = batchMatch(groups.bothPool, groups.bothPool, scoreMatrix, {
    useHungarianFirst: false,
    maxMatchesPerUser: 1,
    minScoreThreshold: MIN_SCORE_THRESHOLD,
  });

  const processed = new Set<string>();
  for (const p of [...primaryPairs, ...bothPairs]) {
    const k = p.leftId < p.rightId ? `${p.leftId}-${p.rightId}` : `${p.rightId}-${p.leftId}`;
    if (processed.has(k)) continue;
    processed.add(k);

    const score = scoreMatrix.get(p.leftId)?.get(p.rightId) ?? scoreMatrix.get(p.rightId)?.get(p.leftId);
    if (!score || score.total < MIN_SCORE_THRESHOLD) continue;

    matchPairs.push({ leftId: p.leftId, rightId: p.rightId, score: score.total });
  }
}

const matchMs = performance.now() - matchStart;
console.log(`[random-report] matched pairs=${matchPairs.length} in ${matchMs.toFixed(1)}ms`);

// Sort matches by score desc for reporting
matchPairs.sort((a, b) => b.score - a.score);

// validate: each user <= 1 match
const matchCountByUser = new Map<string, number>();
for (const p of matchPairs) {
  matchCountByUser.set(p.leftId, (matchCountByUser.get(p.leftId) ?? 0) + 1);
  matchCountByUser.set(p.rightId, (matchCountByUser.get(p.rightId) ?? 0) + 1);
}

const usersMatched = [...matchCountByUser.entries()].filter(([, c]) => c > 0).length;
const usersUnmatched = users.length - usersMatched;
const violations = [...matchCountByUser.entries()].filter(([, c]) => c > 1);

// 4) create report
const reportPath = `docs/test-reports/matching/${dateTag}_random-${n}_seed-${seed}.md`;
console.log(`[random-report] writing report -> ${reportPath}`);

const samplePairPath = `docs/test-reports/matching/${dateTag}_random-${n}_seed-${seed}_sample-pair.md`;

const totalPossiblePairs = (n * (n - 1)) / 2;
const hist10 = histogram(uniqueScores, 10);

const top10 = pairScores.slice(0, 10);
const top10Lines = top10.map((p, idx) => {
  const d = p.dims;
  return `| ${idx + 1} | ${p.a} | ${p.b} | ${p.score.toFixed(2)} | ${d.valueAlignment.toFixed(1)} | ${d.lifestyleFit.toFixed(1)} | ${d.personalityMatch.toFixed(1)} | ${d.interestOverlap.toFixed(1)} | ${d.expectationMatch.toFixed(1)} |`;
});

const unmatchedPreview = users
  .map((u) => u.id)
  .filter((id) => (matchCountByUser.get(id) ?? 0) === 0)
  .slice(0, 30);

const md = `# 匹配算法随机测试报告（${dateTag}）

- 生成时间：${startedAt.toISOString()}
- 随机种子（seed）：${seed}
- 随机用户数：${n}
- 分数阈值：${MIN_SCORE_THRESHOLD}
- 使用算法分支：${algorithm}（与 match-scheduler 按规模选择一致）

## 1. 用户分布

- 性别：male=${maleCount}, female=${femaleCount}
- expected_gender=both 的人数：${expectedBothCount}

## 2. 评分矩阵统计

- 理论两两组合数：${totalPossiblePairs}
- scoreMatrix 有向边数（score.total>0）：${totalDirectedEdges}
- 去重后有效评分对数（按 a<b 计）：${uniqueScores.length}
- 平均分：${avgScore.toFixed(2)}（min=${minScore.toFixed(2)}, max=${maxScore.toFixed(2)}）

### 2.1 阈值以上占比

- ≥${MIN_SCORE_THRESHOLD}：${pass55} / ${uniqueScores.length} (${formatPct(uniqueScores.length ? pass55 / uniqueScores.length : 0)})
- ≥60：${pass60} / ${uniqueScores.length} (${formatPct(uniqueScores.length ? pass60 / uniqueScores.length : 0)})
- ≥70：${pass70} / ${uniqueScores.length} (${formatPct(uniqueScores.length ? pass70 / uniqueScores.length : 0)})
- ≥80：${pass80} / ${uniqueScores.length} (${formatPct(uniqueScores.length ? pass80 / uniqueScores.length : 0)})

### 2.2 分数直方图（bucket=10）

| 区间 | 数量 |
|---|---:|
${hist10.map((h) => `| ${h.label} | ${h.count} |`).join("\n")}

### 2.3 Top 10 高分配对（仅用于调试）

| # | userA | userB | total | value | lifestyle | personality | interest | expectation |
|---:|---|---|---:|---:|---:|---:|---:|---:|
${top10Lines.join("\n")}

## 3. 匹配结果统计（每人最多 1 个）

- 匹配对数：${matchPairs.length}
- 被匹配到的用户数：${usersMatched}
- 未匹配用户数：${usersUnmatched}
- 约束违规（任一用户>1配对）：${violations.length === 0 ? "无" : `有 ${violations.length} 个（请检查实现）`}

### 3.1 未匹配用户预览（最多 30 个）

${unmatchedPreview.length ? unmatchedPreview.map((id) => `- ${id}`).join("\n") : "- 无"}

## 4. 性能（本机一次运行）

- 生成用户：${genMs.toFixed(1)}ms
- 构建分数矩阵：${matrixMs.toFixed(1)}ms
- 执行匹配：${matchMs.toFixed(1)}ms

## 5. 备注

- 本报告使用 seed 固定随机序列，可复现实验：
  - \`deno run --allow-read --allow-write docs/edge-functions/matching/generate_random_report.ts --n=${n} --seed=${seed}\`
${noSample ? "- 已关闭示例配对问卷导出（--no-sample）" : `- 示例配对问卷导出：\`${samplePairPath}\``}
`;

await Deno.writeTextFile(reportPath, md);

// 6) dump one successful pair's questionnaires (optional)
if (!noSample && matchPairs.length > 0) {
  const best = matchPairs[0];
  const aUser = users.find((u) => u.id === best.leftId);
  const bUser = users.find((u) => u.id === best.rightId);
  const score =
    scoreMatrix.get(best.leftId)?.get(best.rightId) ??
    scoreMatrix.get(best.rightId)?.get(best.leftId);

  const pairMd = `# 匹配成功样本配对（${dateTag}）\n\n` +
    `- 随机种子（seed）：${seed}\n` +
    `- 随机用户数：${n}\n` +
    `- 分数阈值：${MIN_SCORE_THRESHOLD}\n` +
    `- 配对：${best.leftId}  ↔  ${best.rightId}\n` +
    `- 总分：${best.score.toFixed(2)}/100\n` +
    (score ? `- 维度分：${JSON.stringify(score.dimensions)}\n` : "") +
    `\n> 说明：以下为该配对两位用户的 profile + module1-5 原始选项（随机生成，用于调试算法）。\n\n` +
    (aUser ? dumpCandidate(aUser) : `## ${best.leftId}\n\n未找到该用户数据\n`) +
    "\n\n---\n\n" +
    (bUser ? dumpCandidate(bUser) : `## ${best.rightId}\n\n未找到该用户数据\n`);

  await Deno.writeTextFile(samplePairPath, pairMd);
  console.log(`[random-report] wrote ${samplePairPath}`);
} else if (noSample) {
  console.log("[random-report] --no-sample enabled; skip sample pair dump");
} else {
  console.log("[random-report] no matches; skip sample pair dump");
}

console.log(`[random-report] wrote ${reportPath}`);
if (violations.length) {
  console.error("[random-report] match-limit violations:", violations.slice(0, 10));
  Deno.exit(2);
}
