import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/services/authService';
import type { ContactMethod } from '@/services/contactMethodsService';

// ============================================================
// 结构化冰破服务 — 替代匿名自由聊天
// 三轮流程：共鸣时刻 → 破冰任务 → 心电感应（交换联系方式）
// ============================================================

// ---- 类型定义 ----

export type IceMessageType = 'ice_round_1' | 'ice_round_2' | 'ice_round_3' | 'connection_card';

export interface ChatContext {
  matchId: string;
  partnerId: string | null;
  partnerStage: string | null;
  partnerNickname: string | null;
  matchRate: number | null;
  isDemo: boolean;
}

export interface IceReplyResult {
  id: string;
  round: number;
  content: string;
  createdAt: string;
}

export interface RoundStatus {
  currentRound: number;
  myReplies: Record<number, string>;
  partnerReplies: Record<number, IceReplyResult>;
  partnerConfirmed: boolean;
  iConfirmed: boolean;
}

export interface ReportPayload {
  reason: string;
  details?: string;
}

export interface BlockStatus {
  isBlocked: boolean;
}

// ---- 缓存 ----

let chatContextCache: {
  userId: string;
  context: ChatContext;
  expiresAt: number;
} | null = null;

const CHAT_CONTEXT_CACHE_TTL_MS = 10000;

// ---- 模拟回复模板（demo/localStorage 模式）----

const DEMO_PARTNER_REPLIES: Record<number, string[]> = {
  1: [
    '我也深有同感！每次深夜一个人听歌的时候，就感觉整个世界都安静下来了。',
    '太巧了，我也是这样。有时候觉得能找到共鸣的人真的很难得。',
  ],
  2: [
    '这个任务很有意思！我觉得一起完成的话会是很棒的体验。',
    '哈哈，没想到我们在这方面也这么合拍。',
  ],
  3: [
    '当然愿意！很高兴认识你。',
  ],
};

// ---- localStorage Keys ----

const LOCAL_ICE_REPLIES_KEY = 'stitch_o_match_ice_replies';
const LOCAL_ICE_CONFIRM_KEY = 'stitch_o_match_ice_confirm';
const LOCAL_ACTIVE_CHAT_MATCH_KEY = 'stitch_o_match_active_chat_match';
const LOCAL_CHAT_UNREAD_COUNT_KEY = 'stitch_o_match_chat_unread_count';
const LOCAL_BLOCK_STATUS_KEY = 'stitch_o_match_block_status';

// ---- localStorage 工具（demo 模式用）----

interface LocalIceReply {
  id: string;
  matchId: string;
  round: number;
  userId: string;
  content: string;
  createdAt: string;
}

const readLocalIceReplies = (): LocalIceReply[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ICE_REPLIES_KEY);
    return raw ? (JSON.parse(raw) as LocalIceReply[]) : [];
  } catch {
    return [];
  }
};

const writeLocalIceReply = (reply: LocalIceReply) => {
  const replies = readLocalIceReplies();
  replies.push(reply);
  localStorage.setItem(LOCAL_ICE_REPLIES_KEY, JSON.stringify(replies));
};

const readLocalConfirmState = (matchId: string): { iConfirmed: boolean; partnerConfirmed: boolean } => {
  try {
    const raw = localStorage.getItem(LOCAL_ICE_CONFIRM_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, { iConfirmed: boolean; partnerConfirmed: boolean }>) : {};
    return all[matchId] ?? { iConfirmed: false, partnerConfirmed: false };
  } catch {
    return { iConfirmed: false, partnerConfirmed: false };
  }
};

const writeLocalConfirmState = (matchId: string, state: { iConfirmed: boolean; partnerConfirmed: boolean }) => {
  try {
    const raw = localStorage.getItem(LOCAL_ICE_CONFIRM_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, { iConfirmed: boolean; partnerConfirmed: boolean }>) : {};
    all[matchId] = state;
    localStorage.setItem(LOCAL_ICE_CONFIRM_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
};

// ---- 未读计数（保留给通知系统用）----

export const getLocalChatUnreadCount = (): number => {
  const raw = localStorage.getItem(LOCAL_CHAT_UNREAD_COUNT_KEY);
  if (raw === null) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const setLocalChatUnreadCount = (count: number): void => {
  localStorage.setItem(LOCAL_CHAT_UNREAD_COUNT_KEY, String(Math.max(0, count)));
  window.dispatchEvent(new Event('chat-unread-updated'));
};

export const incrementLocalChatUnreadCount = (delta = 1): void => {
  setLocalChatUnreadCount(getLocalChatUnreadCount() + delta);
};

export const clearLocalChatUnreadCount = (): void => {
  setLocalChatUnreadCount(0);
};

export const setActiveLocalChatMatchId = (matchId: string | null): void => {
  if (matchId) {
    localStorage.setItem(LOCAL_ACTIVE_CHAT_MATCH_KEY, matchId);
  } else {
    localStorage.removeItem(LOCAL_ACTIVE_CHAT_MATCH_KEY);
  }
};

// ---- ChatContext 解析 ----

export const resolveChatContext = async (): Promise<ChatContext> => {
  if (!hasSupabaseConfig || !supabase) {
    return {
      matchId: 'demo-match',
      partnerId: null,
      partnerStage: null,
      partnerNickname: null,
      matchRate: null,
      isDemo: true,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      matchId: 'demo-match',
      partnerId: null,
      partnerStage: null,
      partnerNickname: null,
      matchRate: null,
      isDemo: true,
    };
  }

  if (chatContextCache && chatContextCache.userId === user.id && chatContextCache.expiresAt > Date.now()) {
    return chatContextCache.context;
  }

  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .select('id, user_a_id, user_b_id, status, created_at, match_rate')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in('status', ['matched', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchError || !matchData) {
    return {
      matchId: 'demo-match',
      partnerId: null,
      partnerStage: null,
      partnerNickname: null,
      matchRate: null,
      isDemo: true,
    };
  }

  const partnerId = matchData.user_a_id === user.id ? matchData.user_b_id : matchData.user_a_id;
  let partnerStage: string | null = null;
  let partnerNickname: string | null = null;

  if (partnerId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('stage, nickname')
      .eq('id', partnerId)
      .maybeSingle();

    partnerStage = (profileData?.stage as string | null | undefined) ?? null;
    partnerNickname = (profileData?.nickname as string | null | undefined) ?? null;
  }

  const context = {
    matchId: matchData.id,
    partnerId: partnerId ?? null,
    partnerStage,
    partnerNickname,
    matchRate: typeof matchData.match_rate === 'number' ? matchData.match_rate : null,
    isDemo: false,
  };

  chatContextCache = {
    userId: user.id,
    context,
    expiresAt: Date.now() + CHAT_CONTEXT_CACHE_TTL_MS,
  };

  return context;
};

// ============================================================
// 冰破核心逻辑
// ============================================================

/**
 * 提交一轮冰破回复
 */
export const submitIceReply = async (
  matchId: string,
  round: number,
  content: string
): Promise<{ success: boolean; reply?: IceReplyResult; error?: string }> => {
  const clean = content.trim();
  if (!clean) {
    return { success: false, error: '回复不能为空' };
  }

  if (round < 1 || round > 3 || !Number.isInteger(round)) {
    return { success: false, error: '无效的轮次' };
  }

  if (!hasSupabaseConfig || !supabase) {
    // Demo 模式：写入 localStorage
    const user = await getCurrentUser();
    const userId = user?.id || 'demo-user';
    const reply: LocalIceReply = {
      id: `local_ice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      matchId,
      round,
      userId,
      content: clean,
      createdAt: new Date().toISOString(),
    };
    writeLocalIceReply(reply);

    // 模拟对方在 1.5~3 秒后也回复
    const templates = DEMO_PARTNER_REPLIES[round] || ['好的，收到！'];
    const partnerReplyContent = templates[Math.floor(Math.random() * templates.length)];
    const partnerId = 'demo-partner';

    window.setTimeout(() => {
      const partnerReply: LocalIceReply = {
        id: `local_ice_partner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        matchId,
        round,
        userId: partnerId,
        content: partnerReplyContent,
        createdAt: new Date().toISOString(),
      };
      writeLocalIceReply(partnerReply);

      // 触发自定义事件通知页面刷新
      window.dispatchEvent(new CustomEvent('ice-partner-reply', {
        detail: { matchId, round, reply: partnerReply },
      }));

      // 增加未读计数（如果用户不在聊天页）
      if (getActiveLocalChatMatchId() !== matchId) {
        incrementLocalChatUnreadCount();
      }
    }, 1500 + Math.floor(Math.random() * 1500));

    return {
      success: true,
      reply: {
        id: reply.id,
        round,
        content: clean,
        createdAt: reply.createdAt,
      },
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  // 检查拉黑状态
  const { data: blockRows } = await supabase
    .from('chat_blocks')
    .select('blocker_id, blocked_user_id')
    .eq('match_id', matchId)
    .or(`blocker_id.eq.${user.id},blocked_user_id.eq.${user.id}`)
    .limit(5);

  if (blockRows && blockRows.length > 0) {
    const blockedByPartner = blockRows.some(
      (item) => item.blocked_user_id === user.id && item.blocker_id !== user.id
    );
    if (blockedByPartner) {
      return { success: false, error: '对方已将你拉黑，暂时无法发送。' };
    }
    const blockedByMe = blockRows.some(
      (item) => item.blocker_id === user.id && item.blocked_user_id !== user.id
    );
    if (blockedByMe) {
      return { success: false, error: '你已拉黑对方，请先取消拉黑再发送。' };
    }
  }

  const messageType: IceMessageType = `ice_round_${round}` as IceMessageType;

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      match_id: matchId,
      sender_id: user.id,
      content: clean,
      message_type: messageType,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return { success: false, error: '提交失败，请稍后重试' };
  }

  return {
    success: true,
    reply: {
      id: data.id,
      round,
      content: clean,
      createdAt: data.created_at,
    },
  };
};

/**
 * 查询冰破轮次状态
 */
export const getRoundStatus = async (matchId: string): Promise<RoundStatus> => {
  const empty: RoundStatus = {
    currentRound: 1,
    myReplies: {},
    partnerReplies: {},
    partnerConfirmed: false,
    iConfirmed: false,
  };

  if (!hasSupabaseConfig || !supabase) {
    const user = await getCurrentUser();
    const userId = user?.id || 'demo-user';

    const allReplies = readLocalIceReplies().filter((r) => r.matchId === matchId);
    const myReplies: Record<number, string> = {};
    const partnerReplies: Record<number, IceReplyResult> = {};

    for (const r of allReplies) {
      if (r.userId === userId) {
        myReplies[r.round] = r.id;
      } else {
        partnerReplies[r.round] = {
          id: r.id,
          round: r.round,
          content: r.content,
          createdAt: r.createdAt,
        };
      }
    }

    const confirmState = readLocalConfirmState(matchId);

    // 计算当前轮次
    let currentRound: number = 1;
    if (myReplies[1] && partnerReplies[1]) {
      currentRound = 2;
      if (myReplies[2] && partnerReplies[2]) {
        currentRound = 3;
      }
    }

    return {
      currentRound,
      myReplies,
      partnerReplies,
      partnerConfirmed: confirmState.partnerConfirmed,
      iConfirmed: confirmState.iConfirmed,
    };
  }

  const user = await getCurrentUser();
  if (!user) return empty;

  // 查询所有冰破消息
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, content, message_type, created_at')
    .eq('match_id', matchId)
    .in('message_type', ['ice_round_1', 'ice_round_2', 'ice_round_3', 'connection_card'])
    .order('created_at', { ascending: true });

  if (error || !messages) return empty;

  const myReplies: Record<number, string> = {};
  const partnerReplies: Record<number, IceReplyResult> = {};
  let partnerConfirmed = false;
  let iConfirmed = false;

  for (const msg of messages) {
    const msgType = msg.message_type as string;

    if (msgType === 'connection_card') {
      if (msg.sender_id === user.id) {
        iConfirmed = true;
      } else {
        partnerConfirmed = true;
      }
      continue;
    }

    // ice_round_N
    const roundMatch = msgType.match(/^ice_round_(\d)$/);
    if (!roundMatch) continue;

    const round = parseInt(roundMatch[1], 10);
    const replyResult: IceReplyResult = {
      id: msg.id,
      round,
      content: msg.content,
      createdAt: msg.created_at,
    };

    if (msg.sender_id === user.id) {
      myReplies[round] = msg.id;
    } else {
      partnerReplies[round] = replyResult;
    }
  }

  // 计算当前轮次
  let currentRound: number = 1;
  if (myReplies[1] && partnerReplies[1]) {
    currentRound = 2;
    if (myReplies[2] && partnerReplies[2]) {
      currentRound = 3;
    }
  }

  return { currentRound, myReplies, partnerReplies, partnerConfirmed, iConfirmed };
};

/**
 * Round 3: 确认交换联系方式
 * 插入 connection_card 消息，如果双方都确认则返回对方联系方式
 */
export const confirmConnection = async (
  matchId: string,
  partnerId: string | null
): Promise<{
  success: boolean;
  partnerConfirmed: boolean;
  bothConfirmed: boolean;
  partnerContact?: ContactMethod[];
  error?: string;
}> => {
  if (!hasSupabaseConfig || !supabase) {
    const current = readLocalConfirmState(matchId);

    if (current.iConfirmed) {
      return { success: false, partnerConfirmed: current.partnerConfirmed, bothConfirmed: false, error: '你已经确认过了' };
    }

    const newState = { ...current, iConfirmed: true };
    writeLocalConfirmState(matchId, newState);

    // 模拟对方在 1~2 秒后也确认
    if (!current.partnerConfirmed) {
      window.setTimeout(() => {
        const updated = readLocalConfirmState(matchId);
        writeLocalConfirmState(matchId, { ...updated, partnerConfirmed: true });
        window.dispatchEvent(new CustomEvent('ice-partner-confirmed', { detail: { matchId } }));
      }, 1200 + Math.floor(Math.random() * 800));
    }

    const bothConfirmed = newState.iConfirmed && current.partnerConfirmed;

    // Demo 模式返回模拟联系方式
    if (bothConfirmed) {
      return {
        success: true,
        partnerConfirmed: true,
        bothConfirmed: true,
        partnerContact: [
          { platform: 'wechat', value: 'Orange_Secret', enabled: true },
        ],
      };
    }

    return {
      success: true,
      partnerConfirmed: current.partnerConfirmed,
      bothConfirmed: false,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, partnerConfirmed: false, bothConfirmed: false, error: '登录状态失效，请重新登录' };
  }

  // 插入确认消息
  const { error: insertError } = await supabase
    .from('chat_messages')
    .insert({
      match_id: matchId,
      sender_id: user.id,
      content: '已确认交换联系方式',
      message_type: 'connection_card',
    });

  if (insertError) {
    return { success: false, partnerConfirmed: false, bothConfirmed: false, error: '操作失败，请稍后重试' };
  }

  // 检查对方是否也确认了
  const { data: confirmMessages } = await supabase
    .from('chat_messages')
    .select('sender_id')
    .eq('match_id', matchId)
    .eq('message_type', 'connection_card');

  const partnerConfirmed = (confirmMessages || []).some((m) => m.sender_id !== user.id);
  const bothConfirmed = partnerConfirmed; // 我已经确认（刚插入），检查对方

  // 如果双方都确认，获取对方联系方式
  let partnerContact: ContactMethod[] | undefined;
  if (bothConfirmed && partnerId) {
    const { data: contactData } = await supabase
      .from('user_contact_methods')
      .select('platform, contact_value, enabled')
      .eq('user_id', partnerId)
      .eq('enabled', true);

    partnerContact = (contactData || []).map((row: Record<string, unknown>) => ({
      platform: row.platform as ContactMethod['platform'],
      value: (row.contact_value as string) || '',
      enabled: Boolean(row.enabled),
    }));
  }

  return {
    success: true,
    partnerConfirmed,
    bothConfirmed,
    partnerContact,
  };
};

/**
 * 获取对方联系方式（仅在双方确认后调用）
 */
export const getPartnerContactInfo = async (
  partnerId: string
): Promise<ContactMethod[]> => {
  if (!hasSupabaseConfig || !supabase || !partnerId) {
    return [];
  }

  const { data } = await supabase
    .from('user_contact_methods')
    .select('platform, contact_value, enabled')
    .eq('user_id', partnerId)
    .eq('enabled', true);

  return (data || []).map((row: Record<string, unknown>) => ({
    platform: row.platform as ContactMethod['platform'],
    value: (row.contact_value as string) || '',
    enabled: Boolean(row.enabled),
  }));
};

// ---- localStorage 辅助 ----

const getActiveLocalChatMatchId = (): string | null => {
  const raw = localStorage.getItem(LOCAL_ACTIVE_CHAT_MATCH_KEY);
  return raw && raw.trim() ? raw : null;
};

// ---- 举报/拉黑（保留）----

export const reportUser = async (
  matchId: string,
  reportedUserId: string | null,
  payload: ReportPayload
): Promise<{ success: boolean; error?: string }> => {
  if (!payload.reason.trim()) {
    return { success: false, error: '请填写举报原因' };
  }

  if (!hasSupabaseConfig || !supabase || !reportedUserId) {
    return { success: true };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase.from('chat_reports').insert({
    match_id: matchId,
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    reason: payload.reason.trim(),
    details: (payload.details || '').trim() || null,
  });

  if (error) {
    return { success: false, error: '举报提交失败，请稍后重试' };
  }

  return { success: true };
};

export const blockUser = async (
  matchId: string,
  blockedUserId: string | null,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!hasSupabaseConfig || !supabase || !blockedUserId) {
    writeLocalBlockStatus(matchId, true);
    return { success: true };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase.from('chat_blocks').insert({
    match_id: matchId,
    blocker_id: user.id,
    blocked_user_id: blockedUserId,
    reason: (reason || '').trim() || null,
  });

  if (error) {
    return { success: false, error: '拉黑失败，请稍后重试' };
  }

  writeLocalBlockStatus(matchId, true);
  return { success: true };
};

export const unblockUser = async (
  matchId: string,
  blockedUserId: string | null
): Promise<{ success: boolean; error?: string }> => {
  if (!blockedUserId) {
    return { success: false, error: '缺少拉黑对象' };
  }

  if (!hasSupabaseConfig || !supabase) {
    writeLocalBlockStatus(matchId, false);
    return { success: true };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('chat_blocks')
    .delete()
    .eq('match_id', matchId)
    .eq('blocker_id', user.id)
    .eq('blocked_user_id', blockedUserId);

  if (error) {
    return { success: false, error: '取消拉黑失败，请稍后重试' };
  }

  writeLocalBlockStatus(matchId, false);
  return { success: true };
};

export const getBlockStatus = async (
  matchId: string,
  partnerId: string | null
): Promise<BlockStatus> => {
  if (!partnerId) {
    return { isBlocked: false };
  }

  if (!hasSupabaseConfig || !supabase) {
    return { isBlocked: readLocalBlockStatus(matchId) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { isBlocked: readLocalBlockStatus(matchId) };
  }

  const { data, error } = await supabase
    .from('chat_blocks')
    .select('id')
    .eq('match_id', matchId)
    .eq('blocker_id', user.id)
    .eq('blocked_user_id', partnerId)
    .maybeSingle();

  if (error) {
    return { isBlocked: readLocalBlockStatus(matchId) };
  }

  const isBlocked = Boolean(data);
  writeLocalBlockStatus(matchId, isBlocked);
  return { isBlocked };
};

// ---- localStorage 拉黑工具 ----

const readLocalBlockStatus = (matchId: string): boolean => {
  const raw = localStorage.getItem(LOCAL_BLOCK_STATUS_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(parsed[matchId]);
  } catch {
    return false;
  }
};

const writeLocalBlockStatus = (matchId: string, isBlocked: boolean) => {
  const raw = localStorage.getItem(LOCAL_BLOCK_STATUS_KEY);
  let parsed: Record<string, boolean> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, boolean>;
    } catch {
      parsed = {};
    }
  }
  if (isBlocked) {
    parsed[matchId] = true;
  } else {
    delete parsed[matchId];
  }
  localStorage.setItem(LOCAL_BLOCK_STATUS_KEY, JSON.stringify(parsed));
};
