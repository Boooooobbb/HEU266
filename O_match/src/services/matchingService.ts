/**
 * 匹配服务层
 *
 * 目前使用 localStorage 实现匹配状态管理
 * 后续对接真实后端时，只需替换以下方法即可
 *
 * 后端 API 设计参考：
 * POST /api/matching/join    - 参与本周匹配
 * GET  /api/matching/status   - 获取匹配状态
 * GET  /api/matching/result   - 获取匹配结果（每周三揭晓）
 */

import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/services/authService';
import type { MatchReportData, ResonancePoint } from '@/types';

const MATCHING_STORAGE_KEY = 'stitch_o_match_matching';

export const hasJoinedMatching = (): boolean => {
  const stored = localStorage.getItem(MATCHING_STORAGE_KEY);
  if (!stored) return false;

  try {
    const status = JSON.parse(stored) as MatchingStatus;
    return Boolean(status?.isJoined);
  } catch {
    return false;
  }
};

/**
 * 匹配状态
 */
export interface MatchingStatus {
  isJoined: boolean;       // 是否已参与本周匹配
  joinedAt?: number;       // 参与时间
  matchingId?: string;     // 匹配ID
  matchedUserId?: string;  // 匹配到的用户ID（如果有）
  resultRevealed: boolean;  // 结果是否已揭晓
}

/**
 * 参与本周匹配
 *
 * @returns Promise<MatchingStatus>
 *
 * 后端对接示例:
 * ```typescript
 * const joinMatching = async (): Promise<MatchingStatus> => {
 *   const response = await fetch('/api/matching/join', {
 *     method: 'POST',
 *     headers: {
 *       'Authorization': `Bearer ${getToken()}`,
 *       'Content-Type': 'application/json'
 *     }
 *   });
 *   return response.json();
 * };
 * ```
 */
export const joinMatching = async (): Promise<MatchingStatus> => {
  // TODO: 对接后端 API
  // const response = await fetch('/api/matching/join', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${getToken()}`,
  //   }
  // });
  // return response.json();

  // 当前使用 localStorage 模拟
  const status: MatchingStatus = {
    isJoined: true,
    joinedAt: Date.now(),
    resultRevealed: false,
  };

  localStorage.setItem(MATCHING_STORAGE_KEY, JSON.stringify(status));
  console.log('已参与本周匹配', status);

  return status;
};

/**
 * 获取匹配状态
 *
 * @returns Promise<MatchingStatus>
 *
 * 后端对接示例:
 * ```typescript
 * const getMatchingStatus = async (): Promise<MatchingStatus> => {
 *   const response = await fetch('/api/matching/status', {
 *     headers: {
 *       'Authorization': `Bearer ${getToken()}`,
 *     }
 *   });
 *   return response.json();
 * };
 * ```
 */
export const getMatchingStatus = async (): Promise<MatchingStatus | null> => {
  // TODO: 对接后端 API
  // const response = await fetch('/api/matching/status', {
  //   headers: {
  //     'Authorization': `Bearer ${getToken()}`,
  //   }
  // });
  // if (response.status === 404) return null;
  // return response.json();

  // 当前使用 localStorage 模拟
  const stored = localStorage.getItem(MATCHING_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

/**
 * 取消参与匹配
 *
 * @returns Promise<void>
 *
 * 后端对接示例:
 * ```typescript
 * const cancelMatching = async (): Promise<void> => {
 *   await fetch('/api/matching/cancel', {
 *     method: 'POST',
 *     headers: {
 *       'Authorization': `Bearer ${getToken()}`,
 *     }
 *   });
 * };
 * ```
 */
export const cancelMatching = async (): Promise<void> => {
  // TODO: 对接后端 API
  // await fetch('/api/matching/cancel', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${getToken()}`,
  //   }
  // });

  // 当前使用 localStorage 模拟
  localStorage.removeItem(MATCHING_STORAGE_KEY);
  console.log('已取消参与匹配');
};

/**
 * 获取匹配结果
 * 注意：仅在每周三 12:00 后可调用
 *
 * @returns Promise<{ matchedUser: User | null; message: string }>
 *
 * 后端对接示例:
 * ```typescript
 * const getMatchingResult = async (): Promise<{ matchedUser: User | null; message: string }> => {
 *   const response = await fetch('/api/matching/result', {
 *     headers: {
 *       'Authorization': `Bearer ${getToken()}`,
 *     }
 *   });
 *   return response.json();
 * };
 * ```
 */
export const getMatchingResult = async (): Promise<{ matchedUser: any | null; message: string }> => {
  // TODO: 对接后端 API
  // const response = await fetch('/api/matching/result', {
  //   headers: {
  //     'Authorization': `Bearer ${getToken()}`,
  //   }
  // });
  // return response.json();

  // 当前使用 localStorage 模拟（返回模拟结果）
  const status = await getMatchingStatus();

  if (!status?.isJoined) {
    return { matchedUser: null, message: '您尚未参与本周匹配' };
  }

  // 模拟匹配结果（实际应从后端获取）
  return {
    matchedUser: {
      id: 'matched_user_123',
      nickname: '灵魂伴侣',
      // 其他用户信息...
    },
    message: '匹配成功！'
  };
};

/**
 * 检查匹配结果并返回对应的路由路径
 * 后端匹配引擎给出结果后调用此函数决定跳转页面
 *
 * @returns Promise<string> 返回 '/match-success' 或 '/match-fail'
 *
 * 后端对接示例:
 * ```typescript
 * const checkMatchingResult = async (): Promise<string> => {
 *   const response = await fetch('/api/matching/result', {
 *     headers: {
 *       'Authorization': `Bearer ${getToken()}`,
 *     }
 *   });
 *   const data = await response.json();
 *   return data.matchedUser ? '/match-success' : '/match-fail';
 * };
 * ```
 */
export const checkMatchingResult = async (): Promise<string> => {
  // TODO: 对接后端 API
  // const response = await fetch('/api/matching/result', {
  //   headers: {
  //     'Authorization': `Bearer ${getToken()}`,
  //   }
  // });
  // const data = await response.json();
  // return data.matchedUser ? '/match-success' : '/match-fail';

  // 当前使用 localStorage 模拟
  // 模拟：随机返回成功或失败（实际应由后端判断）
  const result = await getMatchingResult();

  if (result.matchedUser) {
    // 保存匹配结果到本地
    const status = await getMatchingStatus();
    if (status) {
      status.matchedUserId = result.matchedUser.id;
      status.resultRevealed = true;
      localStorage.setItem(MATCHING_STORAGE_KEY, JSON.stringify(status));
    }
    return '/match-success';
  } else {
    return '/match-fail';
  }
};

/**
 * 获取当前用户的匹配报告数据
 * 从 Supabase matches + match_reports 表读取真实数据
 */
export const getUserMatchReport = async (): Promise<MatchReportData | null> => {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // 1. 查询当前用户的匹配记录
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, user_a_id, user_b_id, match_rate, expires_at, created_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in('status', ['matched', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchErr || !match) return null;

  // 2. 查询匹配报告
  const { data: report, error: reportErr } = await supabase
    .from('match_reports')
    .select('content')
    .eq('match_id', match.id)
    .maybeSingle();

  if (reportErr) return null;

  // 3. 解析报告内容
  const content = report
    ? (typeof report.content === 'string' ? JSON.parse(report.content) : report.content)
    : null;

  // 4. 获取对方信息
  const partnerId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
  const { data: partnerProfile } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, stage')
    .eq('id', partnerId)
    .maybeSingle();

  // 5. 倒计时
  const now = Date.now();
  const expiresAt = match.expires_at ? new Date(match.expires_at).getTime() : now + 3 * 24 * 3600 * 1000;
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const timeRemaining = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  // 6. 生成共鸣时刻卡片（从高维度 + 共同话题）
  const dimensions = content?.dimensions || [];
  const resonancePoints: ResonancePoint[] = [];
  const highDims = dimensions
    .filter((d: { score: number }) => d.score >= 75)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const colorPalette: ('primary' | 'secondary' | 'tertiary')[] = ['primary', 'secondary', 'tertiary'];
  let colorIdx = 0;

  for (const dim of highDims) {
    resonancePoints.push({
      icon: getDimensionIcon(dim.name),
      title: dim.name,
      description: getDimensionDescription(dim.name, dim.score),
      color: colorPalette[colorIdx % 3],
    });
    colorIdx++;
  }

  // 从共同话题生成额外卡片
  const topics = content?.highlight_topics || [];
  const topicIcons = ['location_on', 'local_cafe', 'sports_esports', 'menu_book'];
  for (let i = 0; i < Math.min(topics.length, 3 - highDims.length); i++) {
    if (resonancePoints.length >= 3) break;
    resonancePoints.push({
      icon: topicIcons[i] || 'stars',
      title: `共同据点: ${topics[i]}`,
      description: `你们在「${topics[i]}」有着共同的回忆或偏好，不妨约一次线下偶遇。`,
      color: colorPalette[colorIdx % 3],
    });
    colorIdx++;
  }

  // 确保至少有1张卡片
  if (resonancePoints.length === 0) {
    resonancePoints.push({
      icon: 'favorite',
      title: '缘分相遇',
      description: content?.summary || '在茫茫人海中，你们的匹配是一次美好的相遇。',
      color: 'primary',
    });
  }

  // 7. 破冰任务
  const iceBreakingTask = {
    title: topics.length > 0 ? `${topics[0]}之旅` : '初次邂逅',
    description: content?.summary
      ? `${content.summary}。${topics.length > 0 ? `不妨从「${topics[0]}」这个话题开始你们的第一次对话吧。` : '主动打个招呼，开启你们的缘分吧！'}`
      : '主动打个招呼，开启你们的缘分吧！',
    location: topics.length > 0 ? topics[0] : '校园',
  };

  // 8. rankPercent 估算（基于1000人测试分布: mean=54.4, SD=7.1）
  const score = match.match_rate || (content?.compatibility_score as number) || 50;
  const zScore = (score - 54.4) / 7.1;
  const rankPercent = Math.round(normalCDF(zScore) * 1000) / 10;

  return {
    matchId: match.id,
    compatibilityScore: Math.round(score * 10) / 10,
    rankPercent,
    dimensions: dimensions.map((d: { name: string; score: number; weight: number }) => ({
      name: d.name,
      score: Math.round(d.score * 10) / 10,
      weight: d.weight,
    })),
    summary: (content?.summary as string) || '在多个维度都有不错的契合度',
    highlightTopics: topics,
    resonancePoints,
    iceBreakingTask,
    partnerInfo: {
      id: partnerId,
      nickname: partnerProfile?.nickname || '灵魂伴侣',
      avatar: partnerProfile?.avatar_url,
    },
    timeRemaining,
  };
};

function getDimensionIcon(name: string): string {
  if (name.includes('价值观')) return 'psychology';
  if (name.includes('习惯') || name.includes('生活')) return 'routine';
  if (name.includes('性格')) return 'mood';
  if (name.includes('关系') || name.includes('期待')) return 'favorite';
  if (name.includes('期望')) return 'verified';
  return 'stars';
}

function getDimensionDescription(name: string, score: number): string {
  if (name.includes('价值观')) {
    return `你们在价值观维度达到了 ${score}% 的契合度，对金钱、未来规划和人生态度有着相似的看法。`;
  }
  if (name.includes('习惯') || name.includes('生活')) {
    return `生活习惯匹配度 ${score}%，日常作息、卫生习惯等方面的兼容性让你们相处更轻松。`;
  }
  if (name.includes('性格')) {
    return `性格互补度 ${score}%，你们在人格特质上形成了良好的互补或相似关系。`;
  }
  if (name.includes('关系') || name.includes('期待')) {
    return `关系期待匹配度 ${score}%，你们在爱的语言和情感需求上高度合拍。`;
  }
  if (name.includes('期望')) {
    return `期望匹配度 ${score}%，你们对亲密关系的未来规划一致，这是长久关系的基础。`;
  }
  return `该维度得分 ${score}%，是你们关系中的重要加分项。`;
}

/** 标准正态分布 CDF 近似 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}