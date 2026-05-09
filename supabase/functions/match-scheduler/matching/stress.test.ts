/**
 * 匹配算法压力测试
 * 使用200个随机模拟用户进行完整匹配流程测试
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  checkGenderConstraint,
  checkStageConstraint,
  checkModule2Bottomlines,
  calculateLifestyleFit,
  calculatePersonalityMatch,
  calculateValueAlignment,
  calculateInterestOverlap,
  calculateExpectationMatch,
  calculateMatchScore,
} from "./scoreCalculator.ts";
import {
  runGaleShapleyMatching,
  groupUsersByPreference,
  buildScoreMatrix,
} from "./galeShapley.ts";
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
} from "./types.ts";

// 本次测试使用的阈值（0-100 百分制）
const TEST_THRESHOLD = 55;

// ============ 随机数据生成器 ============

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

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: readonly T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateModule1(userId: string): Module1Answers {
  const gender = randomChoice(GENDERS);
  const expectedGender = randomChoice(EXPECTED_GENDERS);

  const stage = randomChoice(STAGES);
  let partnerStages: string[];

  if (Math.random() < 0.3) {
    partnerStages = ["both"];
  } else {
    const stageIndex = STAGES.indexOf(stage);
    const count = randomInt(1, Math.min(3, STAGES.length - stageIndex));
    partnerStages = STAGES.slice(stageIndex, stageIndex + count);
  }

  return {
    gender,
    expectedGender,
    stage,
    partnerStages,
    locations: randomSubset(LOCATIONS, 1, 4),
  };
}

function generateModule2(): Module2Answers {
  return {
    q1Schedule: randomChoice(SCHEDULES),
    q1Attitude: randomChoice(ATTITUDES),
    q2Space: randomChoice(SPACES),
    q2Tolerance: randomChoice(ATTITUDES),
    q3Frequency: randomChoice(FREQUENCIES),
    q3Bottomline: randomChoice(ATTITUDES),
    q4Smoking: randomChoice(SMOKING),
    q4Bottomline: randomChoice(ATTITUDES),
    q5Alcohol: randomChoice(ALCOHOL),
    q5Bottomline: randomChoice(ATTITUDES),
  };
}

function generateModule3(): Module3Answers {
  const module: Module3Answers = {
    q1Slider: randomInt(0, 4), q1Preference: randomChoice(PREFERENCES),
    q2Slider: randomInt(0, 4), q2Preference: randomChoice(PREFERENCES),
    q3Slider: randomInt(0, 4), q3Preference: randomChoice(PREFERENCES),
    q4Slider: randomInt(0, 4), q4Preference: randomChoice(PREFERENCES),
    q5Slider: randomInt(0, 4), q5Preference: randomChoice(PREFERENCES),
    q6Slider: randomInt(0, 4), q6Preference: randomChoice(PREFERENCES),
    q7Slider: randomInt(0, 4), q7Preference: randomChoice(PREFERENCES),
    q8Slider: randomInt(0, 4), q8Preference: randomChoice(PREFERENCES),
    q9Slider: randomInt(0, 4), q9Preference: randomChoice(PREFERENCES),
    q10Slider: randomInt(0, 4), q10Preference: randomChoice(PREFERENCES),
  };
  return module;
}

function generateModule4(): Module4Answers {
  return {
    q1: randomChoice(MONEY_VALUES),
    q2: randomChoice(FUTURE_PLANS),
    q3: randomChoice(PRESSURE_CHOICES),
    q4: randomChoice(RISK_PREFERENCES),
    q5: randomChoice(RELATION_STYLES),
    q6: randomChoice(WEEKEND_STYLES),
  };
}

function generateModule5(): Module5Answers {
  return {
    q1: randomChoice(ATTACHMENTS),
    q2: randomSubset(LOVE_LANGUAGES, 1, 3),
    q3: randomChoice(SPACE_PREFERENCES),
    q4: randomChoice(SUPPORTS),
    q5: randomChoice(SECURITIES),
    q6: randomChoice(CONSUMPTIONS),
    q7: randomSubset(CORE_FEELINGS, 1, 3),
  };
}

function generateCandidateUser(id: string): CandidateUser {
  const module1 = generateModule1(id);

  // 根据 module1 设置 profile
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
    module2: generateModule2(),
    module3: generateModule3(),
    module4: generateModule4(),
    module5: generateModule5(),
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

// ============ 统计结构 ============

interface TestStats {
  totalUsers: number;
  maleCount: number;
  femaleCount: number;
  bothCount: number;
  totalPairs: number;
  validPairs: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  threshold55Count: number;
  threshold60Count: number;
  threshold70Count: number;
  excludedPairs: number;
  gsMatches: number;
  greedyMatches: number;
  scoreDistribution: number[];
}

// ============ 测试用例 ============

Deno.test("压力测试 - 5000个随机用户 (阈值=12)", async () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`匹配算法压力测试 - 5000个随机用户`);
  console.log(`MIN_SCORE_THRESHOLD = 12`);
  console.log(`${"=".repeat(60)}\n`);

  // 生成5000个随机用户
  const startTime = Date.now();
  const users: CandidateUser[] = [];
  for (let i = 1; i <= 5000; i++) {
    users.push(generateCandidateUser(`user_${i}`));
  }
  const generationTime = Date.now() - startTime;
  console.log(`[1] 生成5000个随机用户: ${generationTime}ms`);

  // 统计用户分布
  const maleCount = users.filter(u => u.profile.gender === "male").length;
  const femaleCount = users.filter(u => u.profile.gender === "female").length;

  console.log(`\n[2] 用户分布:`);
  console.log(`    男性: ${maleCount}`);
  console.log(`    女性: ${femaleCount}`);

  // 构建分数矩阵
  const matrixStart = Date.now();
  const scoreMatrix = buildScoreMatrix(users, (a, b) =>
    calculateMatchScore(a.profile, b.profile, a.questionnaire, b.questionnaire)
  );
  const matrixTime = Date.now() - matrixStart;
  console.log(`\n[3] 构建分数矩阵: ${matrixTime}ms`);

  // 统计分数
  const scores: number[] = [];
  let validPairs = 0;
  let excludedPairs = 0;
  let maxScore = 0;
  let minScore = 100;
  let sumScore = 0;

  // 调试：找最高分的配对，分析为什么分数低
  let topScorer: { leftId: string; rightId: string; score: MatchScore } | null = null;

  for (const [leftId, row] of scoreMatrix.entries()) {
    for (const [rightId, score] of row.entries()) {
      if (leftId < rightId) { // 只统计一次
        scores.push(score.total);
        sumScore += score.total;
        if (score.total > maxScore) {
          maxScore = score.total;
          topScorer = { leftId, rightId, score };
        }
        if (score.total < minScore && score.total > 0) minScore = score.total;
        if (score.total >= TEST_THRESHOLD) validPairs++;
        if (score.total === 0) excludedPairs++;
      }
    }
  }

  // 打印最高分配对的详细分数
  if (topScorer) {
    console.log(`\n[4.1] 最高分配对详细分析 (${topScorer.score.total}分):`);
    console.log(`    左用户: ${topScorer.leftId}`);
    console.log(`    右用户: ${topScorer.rightId}`);
    console.log(`    价值观契合: ${topScorer.score.dimensions.valueAlignment}/20`);
    console.log(`    生活习惯: ${topScorer.score.dimensions.lifestyleFit}/15`);
    console.log(`    人格匹配: ${topScorer.score.dimensions.personalityMatch}/25`);
    console.log(`    兴趣重叠: ${topScorer.score.dimensions.interestOverlap}/20`);
    console.log(`    期望匹配: ${topScorer.score.dimensions.expectationMatch}/20`);
  }

  const totalPairs = scores.length;
  const avgScore = totalPairs > 0 ? sumScore / totalPairs : 0;

  // 分数分布统计
  const scoreBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const s of scores) {
    if (s === 0) scoreBuckets[0]++;
    else if (s < 10) scoreBuckets[1]++;
    else if (s < 20) scoreBuckets[2]++;
    else if (s < 30) scoreBuckets[3]++;
    else if (s < 40) scoreBuckets[4]++;
    else if (s < 50) scoreBuckets[5]++;
    else if (s < 60) scoreBuckets[6]++;
    else if (s < 70) scoreBuckets[7]++;
    else if (s < 80) scoreBuckets[8]++;
    else scoreBuckets[9]++;
  }

  console.log(`\n[4] 分数统计:`);
  console.log(`    总配对数: ${totalPairs}`);
  console.log(`    有效配对(≥${TEST_THRESHOLD}分): ${validPairs}`);
  console.log(`    排除配对(避雷/硬约束): ${excludedPairs}`);
  console.log(`    最高分: ${maxScore}`);
  console.log(`    最低分(>0): ${minScore}`);
  console.log(`    平均分: ${avgScore.toFixed(2)}`);

  console.log(`\n[5] 分数分布:`);
  console.log(`    0分:      ${scoreBuckets[0].toString().padStart(5)} (${(scoreBuckets[0]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    1-9分:    ${scoreBuckets[1].toString().padStart(5)} (${(scoreBuckets[1]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    10-19分:  ${scoreBuckets[2].toString().padStart(5)} (${(scoreBuckets[2]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    20-29分:  ${scoreBuckets[3].toString().padStart(5)} (${(scoreBuckets[3]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    30-39分:  ${scoreBuckets[4].toString().padStart(5)} (${(scoreBuckets[4]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    40-49分:  ${scoreBuckets[5].toString().padStart(5)} (${(scoreBuckets[5]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    50-59分:  ${scoreBuckets[6].toString().padStart(5)} (${(scoreBuckets[6]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    60-69分:  ${scoreBuckets[7].toString().padStart(5)} (${(scoreBuckets[7]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    70-79分:  ${scoreBuckets[8].toString().padStart(5)} (${(scoreBuckets[8]/totalPairs*100).toFixed(1)}%)`);
  console.log(`    80-100分: ${scoreBuckets[9].toString().padStart(5)} (${(scoreBuckets[9]/totalPairs*100).toFixed(1)}%)`);

  // 用户分组
  console.log(`\n[6] 用户分组:`);
  const groups = groupUsersByPreference(users);
  console.log(`    期望female的男性: ${groups.malePreferFemale.length}`);
  console.log(`    期望male的女性: ${groups.femalePreferMale.length}`);
  console.log(`    期望both的用户: ${groups.bothPool.length}`);

  // G-S 匹配
  console.log(`\n[7] G-S 匹配算法:`);
  const gsStart = Date.now();
  const gsResults = await runGaleShapleyMatching(users, "2026-W20", scoreMatrix);
  const gsTime = Date.now() - gsStart;
  console.log(`    匹配数: ${gsResults.length}`);
  console.log(`    耗时: ${gsTime}ms`);

  if (gsResults.length > 0) {
    const gsScores = gsResults.map(r => r.score.total);
    const gsAvg = gsScores.reduce((a, b) => a + b, 0) / gsScores.length;
    const gsMax = Math.max(...gsScores);
    const gsMin = Math.min(...gsScores);
    console.log(`    平均分配对分数: ${gsAvg.toFixed(2)}`);
    console.log(`    最高分配对分数: ${gsMax}`);
    console.log(`    最低分配对分数: ${gsMin}`);
  }

  // Greedy 匹配 (仅对 malePreferFemale x femalePreferMale)
  console.log(`\n[8] Hungarian + Greedy 匹配 (男×女):`);
  const greedyStart = Date.now();
  const greedyPairs = batchMatch(
    groups.malePreferFemale,
    groups.femalePreferMale,
    scoreMatrix,
    { useHungarianFirst: true, minScoreThreshold: TEST_THRESHOLD }
  );
  const greedyTime = Date.now() - greedyStart;
  console.log(`    匹配数: ${greedyPairs.length}`);
  console.log(`    耗时: ${greedyTime}ms`);

  if (greedyPairs.length > 0) {
    const greedyScores = greedyPairs.map(p => p.score);
    const greedyAvg = greedyScores.reduce((a, b) => a + b, 0) / greedyScores.length;
    const greedyMax = Math.max(...greedyScores);
    const greedyMin = Math.min(...greedyScores);
    console.log(`    平均分配对分数: ${greedyAvg.toFixed(2)}`);
    console.log(`    最高分配对分数: ${greedyMax}`);
    console.log(`    最低分配对分数: ${greedyMin}`);
  }

  // bothPool 内部匹配 (使用 Hungarian)
  console.log(`\n[9] bothPool 内部匹配 (Hungarian):`);
  if (groups.bothPool.length >= 2) {
    const bothMatrix = buildScoreMatrix(groups.bothPool, (a, b) =>
      calculateMatchScore(a.profile, b.profile, a.questionnaire, b.questionnaire)
    );
    const bothPairs = batchMatch(
      groups.bothPool,
      groups.bothPool,
      bothMatrix,
      { useHungarianFirst: true, minScoreThreshold: TEST_THRESHOLD }
    );
    console.log(`    bothPool大小: ${groups.bothPool.length}`);
    console.log(`    匹配数: ${bothPairs.length}`);

    if (bothPairs.length > 0) {
      const bothScores = bothPairs.map(p => p.score);
      const bothAvg = bothScores.reduce((a, b) => a + b, 0) / bothScores.length;
      console.log(`    平均分配对分数: ${bothAvg.toFixed(2)}`);
    }
  } else {
    console.log(`    bothPool < 2，跳过`);
  }

  // 避雷机制统计
  console.log(`\n[10] 避雷机制统计:`);
  let bottomlineViolations = 0;
  let exclusionCount = 0;

  for (let i = 0; i < Math.min(100, users.length); i++) {
    for (let j = i + 1; j < Math.min(100, users.length); j++) {
      const mod2i = users[i].questionnaire.module2;
      const mod2j = users[j].questionnaire.module2;
      if (mod2i && mod2j) {
        const violations = checkModule2Bottomlines(mod2i, mod2j);
        if (violations.length > 0) {
          bottomlineViolations++;
          if (violations.some(v => v.penalty >= 1.0)) {
            exclusionCount++;
          }
        }
      }
    }
  }
  console.log(`    抽样100对中触犯底线数: ${bottomlineViolations}`);
  console.log(`    触犯绝对红线(A)数: ${exclusionCount}`);

  // 硬约束统计
  console.log(`\n[11] 硬约束统计:`);
  let genderFail = 0;
  let stageFail = 0;

  for (let i = 0; i < Math.min(100, users.length); i++) {
    for (let j = i + 1; j < Math.min(100, users.length); j++) {
      const mod1i = users[i].questionnaire.module1;
      const mod1j = users[j].questionnaire.module1;
      if (mod1i && mod1j) {
        if (!checkGenderConstraint(mod1i, mod1j)) {
          genderFail++;
        }
        if (!checkStageConstraint(mod1i, mod1j)) {
          stageFail++;
        }
      }
    }
  }
  console.log(`    抽样100对中性别不匹配: ${genderFail}`);
  console.log(`    抽样100对中学段不匹配: ${stageFail}`);

  // 总耗时
  const totalTime = Date.now() - startTime;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`总耗时: ${totalTime}ms`);
  console.log(`${"=".repeat(60)}\n`);

  // 验证
  assertEquals(users.length > 4999, true);
  assertEquals(totalPairs > 10000, true);
  assertEquals(Array.isArray(scores), true);
  assertEquals(Array.isArray(gsResults), true);
});

Deno.test("压力测试 - 性能基准 (阈值=12)", async () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`匹配算法性能基准测试 (阈值=12)`);
  console.log(`${"=".repeat(60)}\n`);

  const sizes = [100, 500, 1000, 2000];
  const results: { size: number; matrixTime: number; gsTime: number; total: number }[] = [];

  for (const size of sizes) {
    const users: CandidateUser[] = [];
    for (let i = 1; i <= size; i++) {
      users.push(generateCandidateUser(`bench_${size}_${i}`));
    }

    // 构建分数矩阵
    const matrixStart = Date.now();
    const scoreMatrix = buildScoreMatrix(users, (a, b) =>
      calculateMatchScore(a.profile, b.profile, a.questionnaire, b.questionnaire)
    );
    const matrixTime = Date.now() - matrixStart;

    // G-S 匹配
    const gsStart = Date.now();
    const gsResults = await runGaleShapleyMatching(users, "2026-W20", scoreMatrix);
    const gsTime = Date.now() - gsStart;

    results.push({ size, matrixTime, gsTime, total: matrixTime + gsTime });
    console.log(`  规模${size.toString().padStart(3)}: 矩阵${matrixTime.toString().padStart(4)}ms + G-S${gsTime.toString().padStart(4)}ms = 总${(matrixTime+gsTime).toString().padStart(5)}ms (匹配${gsResults.length}对)`);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // 验证性能在合理范围内
  const lastResult = results[results.length - 1];
  assertEquals(lastResult.total > 0, true);
  assertEquals(lastResult.matrixTime > 0, true);
  assertEquals(lastResult.gsTime > 0, true);
});

console.log("✅ Stress tests loaded");