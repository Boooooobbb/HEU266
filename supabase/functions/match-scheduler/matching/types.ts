/**
 * 匹配算法类型定义
 */

// ============ Module 1: 基础画像 ============
export interface Module1Answers {
  gender: "male" | "female";
  expectedGender: "male" | "female" | "both";
  stage: "undergrad_low" | "undergrad_high" | "master" | "doctor";
  partnerStages: string[]; // 可多选，如 ['undergrad_low', 'undergrad_high', 'both']
  locations: string[];
  interests: string[]; // 兴趣爱好（最多选12个）
}

// ============ Module 2: 生活颗粒度 ============
export type ScheduleType = "early" | "flexible" | "night";
export type SpaceType = "neat" | "chaotic" | "casual";
export type FrequencyType = "high" | "normal" | "low";
export type SmokeType = "never" | "sometimes" | "often";
export type AlcoholType = "never" | "sometimes" | "often";
export type AttitudeType = "A" | "B" | "C"; // A=绝对红线, B=有条件接受, C=完全不介意
export type BottomlineType = "A" | "B" | "C";

export interface Module2Answers {
  q1Schedule: ScheduleType;
  q1Attitude: AttitudeType;
  q2Space: SpaceType;
  q2Tolerance: AttitudeType;
  q3Frequency: FrequencyType;
  q3Bottomline: BottomlineType;
  q4Smoking: SmokeType;
  q4Bottomline: BottomlineType;
  q5Alcohol: AlcoholType;
  q5Bottomline: BottomlineType;
}

// ============ Module 3: 性格调色盘 ============
export type PreferenceType = "similar" | "complement";

export interface Module3Answers {
  q1Slider: number;
  q1Preference: PreferenceType;
  q2Slider: number;
  q2Preference: PreferenceType;
  q3Slider: number;
  q3Preference: PreferenceType;
  q4Slider: number;
  q4Preference: PreferenceType;
  q5Slider: number;
  q5Preference: PreferenceType;
  q6Slider: number;
  q6Preference: PreferenceType;
  q7Slider: number;
  q7Preference: PreferenceType;
  q8Slider: number;
  q8Preference: PreferenceType;
  q9Slider: number;
  q9Preference: PreferenceType;
  q10Slider: number;
  q10Preference: PreferenceType;
}

// ============ Module 4: 三观与旷野 ============
export type MoneyValueType = "save" | "balance" | "enjoy";
export type FuturePlanType = "clear" | "flow" | "explore";
export type PressureChoiceType = "task" | "balance" | "love";
export type RiskPreferenceType = "stable" | "weigh" | "adventure";
export type RelationStyleType = "clear" | "flex" | "emotion";
export type WeekendStyleType = "improve" | "balance" | "relax";

export interface Module4Answers {
  q1: MoneyValueType;
  q2: FuturePlanType;
  q3: PressureChoiceType;
  q4: RiskPreferenceType;
  q5: RelationStyleType;
  q6: WeekendStyleType;
}

// ============ Module 5: 亲密关系说明书 ============
export type AttachmentType = "secure" | "anxious" | "avoidant";
export type SpacePreferenceType = "boundary" | "merge" | "balance";
export type SupportType = "listen" | "analysis" | "distract" | "alone";
export type SecurityType = "certainty" | "tolerance" | "social" | "boundary";
export type ConsumptionType = "communication" | "emotion" | "imbalance" | "compress";

export interface Module5Answers {
  q1: AttachmentType;
  q2: string[]; // 多选：爱的语言
  q3: SpacePreferenceType;
  q4: SupportType;
  q5: SecurityType;
  q6: ConsumptionType;
  q7: string[]; // 多选：核心感受
}

// ============ 完整问卷答案 ============
export interface QuestionnaireAnswers {
  module1?: Module1Answers;
  module2?: Module2Answers;
  module3?: Module3Answers;
  module4?: Module4Answers;
  module5?: Module5Answers;
}

// ============ 用户资料 ============
export interface UserProfile {
  id: string;
  gender: "male" | "female";
  stage: string;
  expected_gender: string;
  partner_stages: string[];
  locations: string[];
  questionnaire_completed?: boolean;
}

// ============ 候选用户（用于匹配算法） ============
export interface CandidateUser {
  id: string;
  profile: UserProfile;
  questionnaire: QuestionnaireAnswers;
  matchState: UserMatchingState;
}

export interface UserMatchingState {
  preferences: string[]; // 按优先级排序的候选用户ID
  receivedOffers: Map<string, MatchScore>; // 收到的配对邀请及分数
  matchedUsers: string[]; // 已接受的配对（最多3个）
  rejectedOffers: Set<string>; // 拒绝的候选用户
}

// ============ 匹配分数 ============
export interface MatchScore {
  total: number; // 总分 0-100（百分制）
  dimensions: {
    valueAlignment: number; // 价值观契合 0-100
    lifestyleFit: number; // 生活习惯匹配 0-100
    personalityMatch: number; // 人格互补/相似 0-100
    interestOverlap: number; // 关系期待匹配 0-100
    expectationMatch: number; // 期望匹配 0-100
    interestMatch: number; // 兴趣匹配 0-100
  };
  breakdown?: {
    sharedLocations: string[]; // 共同活动地点
    sharedInterests: string[]; // 共同兴趣
    personalityCompatibility: string; // 性格相性描述
  };
}

// ============ 匹配结果 ============
export interface MatchResult {
  id: string;
  userAId: string;
  userBId: string;
  score: MatchScore;
  weekTag: string;
  status: "pending" | "matched" | "expired" | "failed";
  expiresAt: string;
  createdAt: string;
}

// ============ 匹配报告 ============
export interface MatchReport {
  matchId: string;
  compatibility: {
    valueAlignment: number;
    lifestyleFit: number;
    personalityMatch: number;
    interestOverlap: number;
    expectationMatch: number;
    interestMatch: number;
  };
  radarData: {
    label: string[];
    score: number[];
  };
  matchReason: string;
  highlightTopics: string[];
}

// ============ 算法常量 ============
export const WEIGHTS = {
  valueAlignment: 0.2, // 20%
  lifestyleFit: 0.2, // 20%
  personalityMatch: 0.2, // 20%
  interestOverlap: 0.15, // 15%
  expectationMatch: 0.15, // 15%
  interestMatch: 0.1, // 10%
} as const;

export const MAX_MATCHES_PER_USER = 1; // 每个用户最多1个匹配
export const MIN_SCORE_THRESHOLD = 40; // 最低匹配分数阈值

// ============ 避雷检查结果 ============
export interface BottomlineViolation {
  dimension: string;
  isViolated: boolean;
  penalty: number; // 0-1, 1表示完全排除
}
