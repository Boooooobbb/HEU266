/**
 * 匹配评分计算器
 *
 * 实现五维度评分函数：
 * 1. 价值观契合度 (Module 4)
 * 2. 生活习惯匹配度 (Module 2) - 含避雷机制
 * 3. 人格互补/相似度 (Module 3)
 * 4. 关系期待匹配度 (Module 5 Q2 爱的语言 + Q7 核心感受)
 * 5. 期望匹配度 (Module 5)
 */

import {
  Module1Answers,
  Module2Answers,
  Module3Answers,
  Module4Answers,
  Module5Answers,
  UserProfile,
  MatchScore,
  BottomlineViolation,
  WEIGHTS,
  ScheduleType,
  SpaceType,
  FrequencyType,
  SmokeType,
  AlcoholType,
  PreferenceType,
} from "./types.ts";

/**
 * 硬约束检查：性别匹配
 * 双方性别必须在对方期望范围内
 */
export function checkGenderConstraint(
  profileA: Pick<Module1Answers, "gender" | "expectedGender">,
  profileB: Pick<Module1Answers, "gender" | "expectedGender">
): boolean {
  const aAcceptsB =
    profileA.expectedGender === "both" ||
    profileA.expectedGender === profileB.gender;

  const bAcceptsA =
    profileB.expectedGender === "both" ||
    profileB.expectedGender === profileA.gender;

  return aAcceptsB && bAcceptsA;
}

/**
 * 硬约束检查：学段匹配
 * 双方学段必须在对方期望范围内
 */
export function checkStageConstraint(
  profileA: Pick<Module1Answers, "stage" | "partnerStages">,
  profileB: Pick<Module1Answers, "stage" | "partnerStages">
): boolean {
  const aAcceptsB =
    profileA.partnerStages.includes("both") ||
    profileA.partnerStages.includes(profileB.stage);

  const bAcceptsA =
    profileB.partnerStages.includes("both") ||
    profileB.partnerStages.includes(profileA.stage);

  return aAcceptsB && bAcceptsA;
}

// ============ Module 2: 避雷机制 ============

// 作息转分数
const scheduleToScore: Record<ScheduleType, number> = {
  early: 5,
  flexible: 3,
  night: 1,
};

// 空间整洁度转分数
const spaceToScore: Record<SpaceType, number> = {
  neat: 5,
  chaotic: 3,
  casual: 1,
};

// 消息频率转分数
const frequencyToScore: Record<FrequencyType, number> = {
  high: 5,
  normal: 3,
  low: 1,
};

// 抽烟频率转分数
const smokeToScore: Record<SmokeType, number> = {
  never: 5,
  sometimes: 3,
  often: 1,
};

// 饮酒频率转分数
const alcoholToScore: Record<AlcoholType, number> = {
  never: 5,
  sometimes: 3,
  often: 1,
};

/**
 * 检查 Module 2 的避雷底线是否被触发
 * 返回每个维度的违规情况和惩罚值
 */
export function checkModule2Bottomlines(
  answersA: Module2Answers,
  answersB: Module2Answers
): BottomlineViolation[] {
  const violations: BottomlineViolation[] = [];

  // Q1: 作息避雷检查
  const scheduleDiff = Math.abs(
    scheduleToScore[answersA.q1Schedule] - scheduleToScore[answersB.q1Schedule]
  );
  if (answersA.q1Attitude === "A" && scheduleDiff >= 2) {
    violations.push({ dimension: "q1", isViolated: true, penalty: 1.0 });
  } else if (answersA.q1Attitude === "A" && scheduleDiff === 1) {
    violations.push({ dimension: "q1", isViolated: true, penalty: 0.3 });
  } else if (answersA.q1Attitude === "B" && scheduleDiff >= 2) {
    violations.push({ dimension: "q1", isViolated: true, penalty: 0.3 });
  }

  // Q2: 空间整洁度避雷检查
  const spaceDiff = Math.abs(
    spaceToScore[answersA.q2Space] - spaceToScore[answersB.q2Space]
  );
  if (answersA.q2Tolerance === "A" && spaceDiff >= 2) {
    violations.push({ dimension: "q2", isViolated: true, penalty: 1.0 });
  } else if (answersA.q2Tolerance === "A" && spaceDiff === 1) {
    violations.push({ dimension: "q2", isViolated: true, penalty: 0.3 });
  } else if (answersA.q2Tolerance === "B" && spaceDiff >= 2) {
    violations.push({ dimension: "q2", isViolated: true, penalty: 0.3 });
  }

  // Q3: 消息频率避雷检查
  const freqA = frequencyToScore[answersA.q3Frequency];
  const freqB = frequencyToScore[answersB.q3Frequency];
  const freqDiff = Math.abs(freqA - freqB);
  // A 表示无法接受"意念回复"，B 表示无法接受"高频互动"
  if (answersA.q3Bottomline === "A" && freqB === 1) {
    violations.push({ dimension: "q3", isViolated: true, penalty: 1.0 });
  } else if (answersA.q3Bottomline === "A" && freqDiff >= 2) {
    violations.push({ dimension: "q3", isViolated: true, penalty: 0.3 });
  }
  if (answersA.q3Bottomline === "B" && freqB === 5) {
    violations.push({ dimension: "q3", isViolated: true, penalty: 1.0 });
  } else if (answersA.q3Bottomline === "B" && freqDiff >= 2) {
    violations.push({ dimension: "q3", isViolated: true, penalty: 0.3 });
  }

  // Q4: 抽烟避雷检查（绝对红线）
  if (answersA.q4Bottomline === "A" && answersB.q4Smoking !== "never") {
    violations.push({ dimension: "q4", isViolated: true, penalty: 1.0 });
  } else if (answersA.q4Bottomline === "B" && answersB.q4Smoking === "often") {
    violations.push({ dimension: "q4", isViolated: true, penalty: 0.3 });
  }

  // Q5: 饮酒避雷检查（绝对红线）
  if (answersA.q5Bottomline === "A" && answersB.q5Alcohol !== "never") {
    violations.push({ dimension: "q5", isViolated: true, penalty: 1.0 });
  } else if (answersA.q5Bottomline === "B" && answersB.q5Alcohol === "often") {
    violations.push({ dimension: "q5", isViolated: true, penalty: 0.3 });
  }

  return violations;
}

/**
 * 计算生活习惯匹配度 (0-15分)
 * 含避雷机制：如果触发绝对红线(A)，直接排除
 */
export function calculateLifestyleFit(
  answersA: Module2Answers,
  answersB: Module2Answers
): { score: number; isExcluded: boolean; violations: BottomlineViolation[] } {
  // 首先检查避雷底线
  const violationsA = checkModule2Bottomlines(answersA, answersB);
  const violationsB = checkModule2Bottomlines(answersB, answersA);

  // 检查是否有绝对红线被触发（penalty = 1.0）
  const hasExclusionA = violationsA.some((v) => v.penalty >= 1.0);
  const hasExclusionB = violationsB.some((v) => v.penalty >= 1.0);

  if (hasExclusionA || hasExclusionB) {
    return { score: 0, isExcluded: true, violations: [...violationsA, ...violationsB] };
  }

  // 计算各维度得分
  let totalScore = 0;

  // Q1: 作息匹配 (3分)
  const scheduleDiff = Math.abs(
    scheduleToScore[answersA.q1Schedule] - scheduleToScore[answersB.q1Schedule]
  );
  let q1Score = 0;
  if (scheduleDiff === 0) q1Score = 3;
  else if (scheduleDiff === 1) q1Score = 2;
  else if (scheduleDiff === 2) q1Score = 1;
  totalScore += q1Score;

  // Q2: 空间整洁度匹配 (3分)
  const spaceDiff = Math.abs(
    spaceToScore[answersA.q2Space] - spaceToScore[answersB.q2Space]
  );
  let q2Score = 0;
  if (spaceDiff === 0) q2Score = 3;
  else if (spaceDiff === 1) q2Score = 2;
  else if (spaceDiff === 2) q2Score = 1;
  totalScore += q2Score;

  // Q3: 消息频率匹配 (3分)
  const freqA = frequencyToScore[answersA.q3Frequency];
  const freqB = frequencyToScore[answersB.q3Frequency];
  const freqDiff = Math.abs(freqA - freqB);
  let q3Score = 0;
  if (freqDiff === 0) q3Score = 3;
  else if (freqDiff === 1) q3Score = 2;
  else if (freqDiff === 2) q3Score = 1;
  totalScore += q3Score;

  // Q4: 抽烟态度匹配 (3分)
  const smokeA = smokeToScore[answersA.q4Smoking];
  const smokeB = smokeToScore[answersB.q4Smoking];
  const smokeDiff = Math.abs(smokeA - smokeB);
  let q4Score = 0;
  if (smokeDiff === 0) q4Score = 3;
  else if (smokeDiff === 1) q4Score = 2;
  else if (smokeDiff === 2) q4Score = 1;
  totalScore += q4Score;

  // Q5: 饮酒态度匹配 (3分)
  const alcoholA = alcoholToScore[answersA.q5Alcohol];
  const alcoholB = alcoholToScore[answersB.q5Alcohol];
  const alcoholDiff = Math.abs(alcoholA - alcoholB);
  let q5Score = 0;
  if (alcoholDiff === 0) q5Score = 3;
  else if (alcoholDiff === 1) q5Score = 2;
  else if (alcoholDiff === 2) q5Score = 1;
  totalScore += q5Score;

  return {
    score: Math.min(totalScore, 15),
    isExcluded: false,
    violations: [...violationsA, ...violationsB],
  };
}

// ============ Module 3: 人格互补/相似 ============

function getSliderValue(answers: Module3Answers, qNum: number): number {
  return answers[`q${qNum}Slider` as keyof Module3Answers] as number;
}

function getPreference(
  answers: Module3Answers,
  qNum: number
): PreferenceType | null {
  return (answers[`q${qNum}Preference` as keyof Module3Answers] as PreferenceType) || null;
}

/**
 * 计算人格互补/相似度 (0-25分)
 *
 * 先看双方偏好，再算分：
 * - similar + similar → 滑块差越小分越高
 * - complement + complement → 滑块差越大分越高
 * - similar + complement → 冲突，较低分
 */
export function calculatePersonalityMatch(
  answersA: Module3Answers,
  answersB: Module3Answers
): number {
  let totalScore = 0;
  const SLIDER_MAX = 4;

  for (let i = 1; i <= 10; i++) {
    const sliderA = getSliderValue(answersA, i);
    const sliderB = getSliderValue(answersB, i);
    const prefA = getPreference(answersA, i);
    const prefB = getPreference(answersB, i);

    if (!prefA || !prefB) continue;

    const sliderDiff = Math.abs(sliderA - sliderB); // 0-4
    const normalizedDiff = sliderDiff / SLIDER_MAX; // 0-1

    let dimScore = 0;

    if (prefA === "similar" && prefB === "similar") {
      // 都选相似 → 差越小分越高
      dimScore = (1 - normalizedDiff) * 2.5;
    } else if (prefA === "complement" && prefB === "complement") {
      // 都选互补 → 差越大分越高
      dimScore = normalizedDiff * 2.5;
    } else {
      // 一方相似一方互补 → 冲突
      dimScore = 0.8;
    }

    totalScore += dimScore;
  }

  return Math.min(Math.round(totalScore * 100) / 100, 25);
}

// ============ Module 4: 价值观契合度 ============

/**
 * 计算价值观契合度 (0-20分)
 * 直接重叠度：答案相同得满分，不同得0分
 */
export function calculateValueAlignment(
  answersA: Module4Answers,
  answersB: Module4Answers
): number {
  const keys: (keyof Module4Answers)[] = ["q1", "q2", "q3", "q4", "q5", "q6"];

  let matchCount = 0;
  for (const key of keys) {
    if (answersA[key] === answersB[key]) {
      matchCount++;
    }
  }

  return Math.round((matchCount / keys.length) * 20 * 100) / 100;
}

// ============ Module 1 Q6: 兴趣匹配 ============

/**
 * 计算兴趣匹配度 (0-20分)
 * 使用 Jaccard 相似系数比较两人的兴趣爱好集合
 */
export function calculateInterestMatch(
  interestsA: string[],
  interestsB: string[]
): number {
  if (!interestsA || !interestsB || (interestsA.length === 0 && interestsB.length === 0)) {
    return 10; // 无数据时给中等分
  }

  const setA = new Set(interestsA);
  const setB = new Set(interestsB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 10;

  const jaccard = intersection.size / union.size;
  return Math.round(jaccard * 20 * 100) / 100;
}

// ============ Module 5: 期望匹配度 + 关系期待 ============

// 依恋类型匹配表
const ATTACHMENT_COMPATIBILITY: Record<string, Record<string, number>> = {
  secure: { secure: 5, anxious: 3, avoidant: 2 },
  anxious: { secure: 3, anxious: 4, avoidant: 2 },
  avoidant: { secure: 2, anxious: 2, avoidant: 5 },
};

// 个人空间偏好匹配表
const SPACE_COMPATIBILITY: Record<string, Record<string, number>> = {
  boundary: { boundary: 5, merge: 1, balance: 3 },
  merge: { boundary: 1, merge: 5, balance: 3 },
  balance: { boundary: 3, merge: 3, balance: 5 },
};

/**
 * 计算兴趣重叠度 (0-20分)
 * 使用 Jaccard 相似系数
 */
export function calculateInterestOverlap(
  locationsA: string[],
  locationsB: string[],
  module5A?: Pick<Module5Answers, "q2" | "q7">,
  module5B?: Pick<Module5Answers, "q2" | "q7">
): number {
  const interestSetA = new Set<string>([
    ...(locationsA || []),
    ...(module5A?.q2 || []),
    ...(module5A?.q7 || []),
  ]);

  const interestSetB = new Set<string>([
    ...(locationsB || []),
    ...(module5B?.q2 || []),
    ...(module5B?.q7 || []),
  ]);

  if (interestSetA.size === 0 && interestSetB.size === 0) {
    return 10; // 无数据时给中等分
  }

  const intersection = new Set([...interestSetA].filter((x) => interestSetB.has(x)));
  const union = new Set([...interestSetA, ...interestSetB]);

  if (union.size === 0) return 10;

  const jaccard = intersection.size / union.size;
  return Math.round(jaccard * 20 * 100) / 100;
}

/**
 * 计算期望匹配度 (0-20分)
 */
export function calculateExpectationMatch(
  answersA: Module5Answers,
  answersB: Module5Answers
): number {
  let totalScore = 0;

  // q1: 依恋类型匹配 (5分)
  const attachScore =
    ATTACHMENT_COMPATIBILITY[answersA.q1]?.[answersB.q1] || 2.5;
  totalScore += attachScore;

  // q3: 个人空间偏好匹配 (5分)
  const spaceScore =
    SPACE_COMPATIBILITY[answersA.q3]?.[answersB.q3] || 2.5;
  totalScore += spaceScore;

  // q4: 情绪支持期望匹配 (5分)
  // 简化为：如果相同或一方是balance，给满分
  if (answersA.q4 === answersB.q4) {
    totalScore += 5;
  } else if (answersA.q4 === "alone" || answersB.q4 === "alone") {
    totalScore += 2; // 独处型与任何类型匹配度都不高
  } else {
    totalScore += 3; // 其他情况给中等分
  }

  // q5: 安全感来源匹配 (5分)
  if (answersA.q5 === answersB.q5) {
    totalScore += 5;
  } else if (
    answersA.q5 === "tolerance" ||
    answersB.q5 === "tolerance" ||
    answersA.q5 === "boundary" ||
    answersB.q5 === "boundary"
  ) {
    totalScore += 3;
  } else {
    totalScore += 2;
  }

  return Math.min(totalScore, 20);
}

// ============ 综合评分函数 ============

/**
 * 计算两个用户的综合匹配分数
 */
export function calculateMatchScore(
  profileA: UserProfile,
  profileB: UserProfile,
  answersA: {
    module1?: Module1Answers;
    module2?: Module2Answers;
    module3?: Module3Answers;
    module4?: Module4Answers;
    module5?: Module5Answers;
  },
  answersB: {
    module1?: Module1Answers;
    module2?: Module2Answers;
    module3?: Module3Answers;
    module4?: Module4Answers;
    module5?: Module5Answers;
  }
): MatchScore {
  // 硬约束检查（优先使用 answers 中的 module1 数据，如果不存在则从 profile 构建）
  const module1A = answersA.module1 || {
    gender: profileA.gender as "male" | "female",
    expectedGender: profileA.expected_gender as "male" | "female" | "both",
    stage: profileA.stage as any,
    partnerStages: profileA.partner_stages,
    locations: profileA.locations,
  };
  const module1B = answersB.module1 || {
    gender: profileB.gender as "male" | "female",
    expectedGender: profileB.expected_gender as "male" | "female" | "both",
    stage: profileB.stage as any,
    partnerStages: profileB.partner_stages,
    locations: profileB.locations,
  };

  if (!checkGenderConstraint(module1A, module1B)) {
    return {
      total: 0,
      dimensions: {
        valueAlignment: 0,
        lifestyleFit: 0,
        personalityMatch: 0,
        interestOverlap: 0,
        expectationMatch: 0,
        interestMatch: 0,
      },
    };
  }

  if (!checkStageConstraint(module1A, module1B)) {
    return {
      total: 0,
      dimensions: {
        valueAlignment: 0,
        lifestyleFit: 0,
        personalityMatch: 0,
        interestOverlap: 0,
        expectationMatch: 0,
        interestMatch: 0,
      },
    };
  }

  // 维度1: 价值观契合 (0-20)
  let valueAlignment = 10; // 默认值
  if (answersA.module4 && answersB.module4) {
    valueAlignment = calculateValueAlignment(answersA.module4, answersB.module4);
  }

  // 维度2: 生活习惯匹配 (0-15) - 含避雷机制
  let lifestyleFit = 7.5; // 默认值
  let isExcluded = false;
  if (answersA.module2 && answersB.module2) {
    const result = calculateLifestyleFit(answersA.module2, answersB.module2);
    lifestyleFit = result.score;
    if (result.isExcluded) {
      isExcluded = true;
    }
  }

  // 如果被排除（触发绝对红线），返回0分
  if (isExcluded) {
    return {
      total: 0,
      dimensions: {
        valueAlignment: 0,
        lifestyleFit: 0,
        personalityMatch: 0,
        interestOverlap: 0,
        expectationMatch: 0,
        interestMatch: 0,
      },
    };
  }

  // 维度3: 人格互补/相似 (0-25)
  let personalityMatch = 12.5; // 默认值
  if (answersA.module3 && answersB.module3) {
    personalityMatch = calculatePersonalityMatch(answersA.module3, answersB.module3);
  }

  // 维度4: 兴趣重叠 (0-20)
  // 注意：locations 不参与计分，只在报告中展示共同地点
  let interestOverlap = 10; // 默认值
  if (answersA.module5 || answersB.module5) {
    interestOverlap = calculateInterestOverlap(
      [], // 不使用 locations
      [], // 不使用 locations
      answersA.module5,
      answersB.module5
    );
  }

  // 维度5: 期望匹配 (0-20)
  let expectationMatch = 10; // 默认值
  if (answersA.module5 && answersB.module5) {
    expectationMatch = calculateExpectationMatch(answersA.module5, answersB.module5);
  }

  // 维度6: 兴趣匹配 (0-20) — Module 1 Q6 hobbies
  let interestMatch = 10; // 默认值
  const interestsA = answersA.module1?.interests || [];
  const interestsB = answersB.module1?.interests || [];
  if (interestsA.length > 0 || interestsB.length > 0) {
    interestMatch = calculateInterestMatch(interestsA, interestsB);
  }

  // 统一输出为 0-100 百分制
  const valueAlignmentPct = (valueAlignment / 20) * 100;
  const lifestyleFitPct = (lifestyleFit / 15) * 100;
  const personalityMatchPct = (personalityMatch / 25) * 100;
  const interestOverlapPct = (interestOverlap / 20) * 100;
  const expectationMatchPct = (expectationMatch / 20) * 100;
  const interestMatchPct = (interestMatch / 20) * 100;

  // 加权求和（权重和为1）
  const total =
    valueAlignmentPct * WEIGHTS.valueAlignment +
    lifestyleFitPct * WEIGHTS.lifestyleFit +
    personalityMatchPct * WEIGHTS.personalityMatch +
    interestOverlapPct * WEIGHTS.interestOverlap +
    expectationMatchPct * WEIGHTS.expectationMatch +
    interestMatchPct * WEIGHTS.interestMatch;

  return {
    total: Math.round(total * 100) / 100,
    dimensions: {
      valueAlignment: Math.round(valueAlignmentPct * 100) / 100,
      lifestyleFit: Math.round(lifestyleFitPct * 100) / 100,
      personalityMatch: Math.round(personalityMatchPct * 100) / 100,
      interestOverlap: Math.round(interestOverlapPct * 100) / 100,
      expectationMatch: Math.round(expectationMatchPct * 100) / 100,
      interestMatch: Math.round(interestMatchPct * 100) / 100,
    },
  };
}

/**
 * 轻量评分：只返回总分（0-100），不构建 MatchScore 对象
 * 用于大规模匹配矩阵构建，节省内存
 * 与 calculateMatchScore 共享相同计算逻辑
 */
export function calculateScoreFast(
  profileA: UserProfile,
  profileB: UserProfile,
  answersA: {
    module1?: Module1Answers;
    module2?: Module2Answers;
    module3?: Module3Answers;
    module4?: Module4Answers;
    module5?: Module5Answers;
  },
  answersB: {
    module1?: Module1Answers;
    module2?: Module2Answers;
    module3?: Module3Answers;
    module4?: Module4Answers;
    module5?: Module5Answers;
  }
): number {
  const mod1A = answersA.module1 || {
    gender: profileA.gender as "male" | "female",
    expectedGender: profileA.expected_gender as "male" | "female" | "both",
    stage: profileA.stage as any,
    partnerStages: profileA.partner_stages,
    locations: profileA.locations,
  };
  const mod1B = answersB.module1 || {
    gender: profileB.gender as "male" | "female",
    expectedGender: profileB.expected_gender as "male" | "female" | "both",
    stage: profileB.stage as any,
    partnerStages: profileB.partner_stages,
    locations: profileB.locations,
  };

  if (!checkGenderConstraint(mod1A, mod1B)) return 0;
  if (!checkStageConstraint(mod1A, mod1B)) return 0;

  // Module 2: 避雷检查
  if (answersA.module2 && answersB.module2) {
    const result = calculateLifestyleFit(answersA.module2, answersB.module2);
    if (result.isExcluded) return 0;
    var lifestyleFit = result.score;
  } else {
    var lifestyleFit = 7.5;
  }

  // Module 4: 价值观
  const valueAlignment = (answersA.module4 && answersB.module4)
    ? calculateValueAlignment(answersA.module4, answersB.module4)
    : 10;

  // Module 3: 人格
  const personalityMatch = (answersA.module3 && answersB.module3)
    ? calculatePersonalityMatch(answersA.module3, answersB.module3)
    : 12.5;

  // Module 5: 兴趣 + 期望
  const interestOverlap = (answersA.module5 || answersB.module5)
    ? calculateInterestOverlap([], [], answersA.module5, answersB.module5)
    : 10;

  const expectationMatch = (answersA.module5 && answersB.module5)
    ? calculateExpectationMatch(answersA.module5, answersB.module5)
    : 10;

  // 维度6: 兴趣匹配
  const interestsA = answersA.module1?.interests || [];
  const interestsB = answersB.module1?.interests || [];
  const interestMatch = (interestsA.length > 0 || interestsB.length > 0)
    ? calculateInterestMatch(interestsA, interestsB)
    : 10;

  // 加权求和 → 0-100 百分制
  const total =
    (valueAlignment / 20) * 100 * WEIGHTS.valueAlignment +
    (lifestyleFit / 15) * 100 * WEIGHTS.lifestyleFit +
    (personalityMatch / 25) * 100 * WEIGHTS.personalityMatch +
    (interestOverlap / 20) * 100 * WEIGHTS.interestOverlap +
    (expectationMatch / 20) * 100 * WEIGHTS.expectationMatch +
    (interestMatch / 20) * 100 * WEIGHTS.interestMatch;

  return Math.round(total * 100) / 100;
}

/**
 * 快速检查两个用户是否可能匹配
 * 用于预筛选，避免不必要的计算
 */
export function canPossiblyMatch(
  profileA: UserProfile,
  profileB: UserProfile
): boolean {
  return checkGenderConstraint(profileA as any, profileB as any) &&
         checkStageConstraint(profileA as any, profileB as any);
}
