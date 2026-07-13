// 用户相关类型
export interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  gender?: 'male' | 'female';
  stage?: 'undergrad_low' | 'undergrad_high' | 'master' | 'doctor';
  createdAt: string;
  verified: boolean;
}

export interface UserProfile {
  userId: string;
  gender: 'male' | 'female';
  expectedGender: 'male' | 'female' | 'both';
  stage: 'undergrad_low' | 'undergrad_high' | 'master' | 'doctor';
  partnerStages: string[];
  locations: string[];
  completedModules: number;
  questionnaireProgress: number;
}

// 问卷相关类型
export interface QuestionnaireAnswer {
  questionId: string;
  value: string | string[];
}

export interface QuestionnaireModule {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'text';
  title: string;
  options?: QuestionOption[];
  required: boolean;
}

export interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
}

// 匹配相关类型
export interface Match {
  id: string;
  matchId: string;
  partner: {
    id: string;
    nickname: string;
    avatar?: string;
    matchRate: number;
  };
  status: 'pending' | 'matched' | 'expired';
  createdAt: string;
  expiresAt: string;
  remainingTime: number; // 秒
}

// 结构化破冰相关类型
export type IceBreakingRound = 1 | 2 | 3;

export interface IceReply {
  id: string;
  round: IceBreakingRound;
  userId: string;
  content: string;
  createdAt: string;
}

export interface IceBreakingState {
  matchId: string;
  currentRound: IceBreakingRound;
  myReplies: Record<number, string>;
  partnerReplies: Record<number, IceReply>;
  partnerConfirmed: boolean;
  iConfirmed: boolean;
  connected: boolean;
}

// 通用 API 响应类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 请求类型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  code: string;
  password: string;
}

export interface SendCodeRequest {
  email: string;
  type: 'register' | 'reset';
}

export interface UpdateProfileRequest {
  gender?: 'male' | 'female';
  expectedGender?: 'male' | 'female' | 'both';
  stage?: string;
  partnerStages?: string[];
  locations?: string[];
}

export interface SubmitAnswerRequest {
  moduleId: string;
  answers: QuestionnaireAnswer[];
}

export interface JoinMatchRequest {
  matchWeek: string;
}

// 匹配报告相关类型
export interface MatchReportDimension {
  name: string;
  score: number;
  weight: number;
}

export interface ResonancePoint {
  icon: string;
  title: string;
  description: string;
  color: 'primary' | 'secondary' | 'tertiary';
}

export interface MatchReportData {
  matchId: string;
  compatibilityScore: number;
  rankPercent: number;
  dimensions: MatchReportDimension[];
  summary: string;
  highlightTopics: string[];
  resonancePoints: ResonancePoint[];
  iceBreakingTask: {
    title: string;
    description: string;
    location: string;
  };
  partnerInfo: {
    id: string;
    nickname: string;
    avatar?: string;
  };
  timeRemaining: string;
}