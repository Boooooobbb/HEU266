import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getCurrentUser as getAuthCurrentUser } from '@/services/authService';
import { addLocalNotificationForUser } from '@/services/notificationService';

const LOCAL_CHAT_MESSAGES_KEY = 'stitch_o_match_chat_messages';
const LOCAL_REVEAL_STATUS_KEY = 'stitch_o_match_reveal_status';
const LOCAL_BLOCK_STATUS_KEY = 'stitch_o_match_block_status';
const LOCAL_CHAT_UNREAD_COUNT_KEY = 'stitch_o_match_chat_unread_count';
const LOCAL_ACTIVE_CHAT_MATCH_KEY = 'stitch_o_match_active_chat_match';
const CHAT_CONTEXT_CACHE_TTL_MS = 10000;
const LOCAL_CHAT_MESSAGE_EVENT = 'chat-local-message';
const LOCAL_CHAT_REACTION_EVENT = 'chat-local-reaction';

export type ChatSender = 'me' | 'partner';
export type RevealStatus = 'anonymous' | 'requested_by_me' | 'requested_by_partner' | 'revealed' | 'rejected';

export interface ChatMessageItem {
  id: string;
  sender: ChatSender;
  content: string;
  time: string;
  type: 'text' | 'contact_card' | 'system';
}

export interface ChatContext {
  matchId: string;
  partnerId: string | null;
  partnerStage: string | null;
  partnerNickname: string | null;
  matchRate: number | null;
  isDemo: boolean;
}

export interface ReportPayload {
  reason: string;
  details?: string;
}

export interface BlockStatus {
  isBlocked: boolean;
}

const initialMessages: ChatMessageItem[] = [];
let chatContextCache: {
  userId: string;
  context: ChatContext;
  expiresAt: number;
} | null = null;

const toClock = (dateInput?: string) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const inferType = (content: string): ChatMessageItem['type'] => {
  if (content.startsWith('[联系方式]')) {
    return 'contact_card';
  }
  if (content.startsWith('[系统]')) {
    return 'system';
  }
  return 'text';
};

const readLocalMessages = (): ChatMessageItem[] => {
  const raw = localStorage.getItem(LOCAL_CHAT_MESSAGES_KEY);
  if (!raw) return initialMessages;

  try {
    const parsed = JSON.parse(raw) as ChatMessageItem[];
    return parsed.length ? parsed : initialMessages;
  } catch {
    return initialMessages;
  }
};

const writeLocalMessages = (messages: ChatMessageItem[]) => {
  localStorage.setItem(LOCAL_CHAT_MESSAGES_KEY, JSON.stringify(messages));
};

const dispatchLocalMessageEvent = (message: ChatMessageItem, options?: { incrementUnread?: boolean }) => {
  window.dispatchEvent(new CustomEvent<{
    message: ChatMessageItem;
    incrementUnread?: boolean;
  }>(LOCAL_CHAT_MESSAGE_EVENT, {
    detail: {
      message,
      incrementUnread: options?.incrementUnread,
    },
  }));
};

const appendLocalMessage = (message: ChatMessageItem, options?: { incrementUnread?: boolean }) => {
  const current = readLocalMessages();
  const next = [...current, message];
  writeLocalMessages(next);
  dispatchLocalMessageEvent(message, options);
};

const scheduleLocalPartnerReply = (matchId: string, sentContent: string) => {
  const replyTemplates = [
    '收到，我再看看',
    '这个很有意思',
    '哈哈，赞同',
    '我也是这么想的',
    '我们很合拍呀',
  ];
  const delayMs = 1400 + Math.floor(Math.random() * 1800);

  window.setTimeout(() => {
    const reply: ChatMessageItem = {
      id: `local_reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: 'partner',
      content: replyTemplates[Math.floor(Math.random() * replyTemplates.length)],
      time: toClock(),
      type: inferType(sentContent.startsWith('[联系方式]') ? '[系统] 好的，我记下了' : 'text'),
    };

    appendLocalMessage(reply);

    if (getActiveLocalChatMatchId() !== matchId) {
      incrementLocalChatUnreadCount();
    }

    void getCurrentUser().then((currentUser) => {
      if (!currentUser?.id) {
        return;
      }

      void addLocalNotificationForUser(currentUser.id, {
        kind: 'chat_message',
        title: '新消息',
        content: reply.content.slice(0, 32),
        linkPath: '/chat-entry',
        channel: 'in_app',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    });

    window.dispatchEvent(new CustomEvent(LOCAL_CHAT_REACTION_EVENT, { detail: { matchId, reply } }));
  }, delayMs);
};

const readLocalRevealStatus = (): RevealStatus => {
  const raw = localStorage.getItem(LOCAL_REVEAL_STATUS_KEY);
  if (
    raw === 'anonymous' ||
    raw === 'requested_by_me' ||
    raw === 'requested_by_partner' ||
    raw === 'revealed' ||
    raw === 'rejected'
  ) {
    return raw;
  }
  return 'anonymous';
};

const writeLocalRevealStatus = (status: RevealStatus) => {
  localStorage.setItem(LOCAL_REVEAL_STATUS_KEY, status);
};

const readLocalBlockStatus = (matchId: string): boolean => {
  const raw = localStorage.getItem(LOCAL_BLOCK_STATUS_KEY);
  if (!raw) {
    return false;
  }

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

const readLocalUnreadCount = (): number => {
  const raw = localStorage.getItem(LOCAL_CHAT_UNREAD_COUNT_KEY);
  if (raw === null) {
    return 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeLocalUnreadCount = (count: number) => {
  localStorage.setItem(LOCAL_CHAT_UNREAD_COUNT_KEY, String(Math.max(0, count)));
  window.dispatchEvent(new Event('chat-unread-updated'));
};

const getActiveLocalChatMatchId = (): string | null => {
  const raw = localStorage.getItem(LOCAL_ACTIVE_CHAT_MATCH_KEY);
  return raw && raw.trim() ? raw : null;
};

export const setActiveLocalChatMatchId = (matchId: string | null): void => {
  if (matchId) {
    localStorage.setItem(LOCAL_ACTIVE_CHAT_MATCH_KEY, matchId);
  } else {
    localStorage.removeItem(LOCAL_ACTIVE_CHAT_MATCH_KEY);
  }
};

export const getLocalChatUnreadCount = (): number => {
  return readLocalUnreadCount();
};

export const setLocalChatUnreadCount = (count: number): void => {
  writeLocalUnreadCount(count);
};

export const incrementLocalChatUnreadCount = (delta = 1): void => {
  writeLocalUnreadCount(readLocalUnreadCount() + delta);
};

export const clearLocalChatUnreadCount = (): void => {
  writeLocalUnreadCount(0);
};

const getCurrentUser = async () => {
  return getAuthCurrentUser();
};

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

  if (
    chatContextCache &&
    chatContextCache.userId === user.id &&
    chatContextCache.expiresAt > Date.now()
  ) {
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

  const matchRate = typeof matchData.match_rate === 'number' ? matchData.match_rate : null;

  const context = {
    matchId: matchData.id,
    partnerId: partnerId ?? null,
    partnerStage,
    partnerNickname,
    matchRate,
    isDemo: false,
  };

  chatContextCache = {
    userId: user.id,
    context,
    expiresAt: Date.now() + CHAT_CONTEXT_CACHE_TTL_MS,
  };

  return context;
};

export const loadMessages = async (matchId: string): Promise<ChatMessageItem[]> => {
  if (!hasSupabaseConfig || !supabase) {
    return readLocalMessages();
  }

  const user = await getCurrentUser();
  if (!user) {
    return readLocalMessages();
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, content, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return readLocalMessages();
  }

  const messages = data.map((item) => ({
    id: item.id,
    sender: item.sender_id === user.id ? 'me' : 'partner',
    content: item.content,
    time: toClock(item.created_at),
    type: inferType(item.content),
  })) as ChatMessageItem[];

  writeLocalMessages(messages);
  return messages.length ? messages : initialMessages;
};

export const sendMessage = async (
  matchId: string,
  content: string
): Promise<{ success: boolean; message?: ChatMessageItem; error?: string }> => {
  const clean = content.trim();
  if (!clean) {
    return { success: false, error: '消息不能为空' };
  }

  const localMessage: ChatMessageItem = {
    id: `local_${Date.now()}`,
    sender: 'me',
    content: clean,
    time: toClock(),
    type: inferType(clean),
  };

  if (!hasSupabaseConfig || !supabase) {
    appendLocalMessage(localMessage);
    scheduleLocalPartnerReply(matchId, clean);
    return { success: true, message: localMessage };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      match_id: matchId,
      sender_id: user.id,
      content: clean,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    const { data: blockRows, error: blockCheckError } = await supabase
      .from('chat_blocks')
      .select('blocker_id, blocked_user_id')
      .eq('match_id', matchId)
      .or(`blocker_id.eq.${user.id},blocked_user_id.eq.${user.id}`)
      .limit(5);

    if (!blockCheckError && blockRows && blockRows.length > 0) {
      const blockedByPartner = blockRows.some(
        (item) => item.blocked_user_id === user.id && item.blocker_id !== user.id
      );
      if (blockedByPartner) {
        return { success: false, error: '对方已将你拉黑，暂时无法发送消息。' };
      }

      const blockedByMe = blockRows.some(
        (item) => item.blocker_id === user.id && item.blocked_user_id !== user.id
      );
      if (blockedByMe) {
        return { success: false, error: '你已拉黑对方，请先取消拉黑再发送消息。' };
      }
    }

    return { success: false, error: '发送失败，请稍后重试' };
  }

  const remoteMessage: ChatMessageItem = {
    id: data.id,
    sender: 'me',
    content: clean,
    time: toClock(data.created_at),
    type: inferType(clean),
  };

  return { success: true, message: remoteMessage };
};

export const sendContactCard = async (
  matchId: string,
  platformLabel: string,
  value: string
): Promise<{ success: boolean; message?: ChatMessageItem; error?: string }> => {
  return sendMessage(matchId, `[联系方式] ${platformLabel}：${value}`);
};

export const subscribeMessages = async (
  matchId: string,
  onMessage: (message: ChatMessageItem) => void
): Promise<() => void> => {
  if (!hasSupabaseConfig || !supabase) {
    const handleLocalMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message: ChatMessageItem;
      }>;

      const message = customEvent.detail?.message;
      if (!message) {
        return;
      }

      onMessage(message);
    };

    window.addEventListener(LOCAL_CHAT_MESSAGE_EVENT, handleLocalMessage);

    return () => {
      window.removeEventListener(LOCAL_CHAT_MESSAGE_EVENT, handleLocalMessage);
    };
  }

  const client = supabase;

  const user = await getCurrentUser();
  const currentUserId = user?.id;

  const channel = client
    .channel(`chat_messages_${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };

        onMessage({
          id: row.id,
          sender: row.sender_id === currentUserId ? 'me' : 'partner',
          content: row.content,
          time: toClock(row.created_at),
          type: inferType(row.content),
        });

        if (row.sender_id !== currentUserId) {
          incrementLocalChatUnreadCount();
        }
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
};

export const getRevealStatus = async (matchId: string): Promise<RevealStatus> => {
  if (!hasSupabaseConfig || !supabase) {
    return readLocalRevealStatus();
  }

  const user = await getCurrentUser();
  if (!user) {
    return readLocalRevealStatus();
  }

  const { data, error } = await supabase
    .from('identity_reveal_requests')
    .select('requester_id, responder_id, status')
    .eq('match_id', matchId)
    .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return readLocalRevealStatus();
  }

  if (data.status === 'accepted') {
    writeLocalRevealStatus('revealed');
    return 'revealed';
  }

  if (data.status === 'rejected') {
    writeLocalRevealStatus('rejected');
    return 'rejected';
  }

  const status: RevealStatus = data.requester_id === user.id ? 'requested_by_me' : 'requested_by_partner';
  writeLocalRevealStatus(status);
  return status;
};

export const requestReveal = async (
  matchId: string,
  partnerId?: string
): Promise<{ success: boolean; status?: RevealStatus; error?: string }> => {
  if (!hasSupabaseConfig || !supabase) {
    writeLocalRevealStatus('requested_by_me');
    return { success: true, status: 'requested_by_me' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  if (!partnerId) {
    writeLocalRevealStatus('requested_by_me');
    return { success: true, status: 'requested_by_me' };
  }

  const { error } = await supabase
    .from('identity_reveal_requests')
    .insert({
      match_id: matchId,
      requester_id: user.id,
      responder_id: partnerId,
      status: 'pending',
    });

  if (error) {
    return { success: false, error: '发起解盲失败，请稍后重试' };
  }

  writeLocalRevealStatus('requested_by_me');
  return { success: true, status: 'requested_by_me' };
};

export const acceptRevealForLocalDemo = async (): Promise<RevealStatus> => {
  writeLocalRevealStatus('revealed');
  return 'revealed';
};

export const acceptReveal = async (
  matchId: string
): Promise<{ success: boolean; status?: RevealStatus; error?: string }> => {
  if (!hasSupabaseConfig || !supabase) {
    writeLocalRevealStatus('revealed');
    return { success: true, status: 'revealed' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('identity_reveal_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('responder_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return { success: false, error: '同意解盲失败，请稍后重试' };
  }

  writeLocalRevealStatus('revealed');
  return { success: true, status: 'revealed' };
};

export const rejectReveal = async (
  matchId: string
): Promise<{ success: boolean; status?: RevealStatus; error?: string }> => {
  if (!hasSupabaseConfig || !supabase) {
    writeLocalRevealStatus('rejected');
    return { success: true, status: 'rejected' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('identity_reveal_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('responder_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return { success: false, error: '拒绝解盲失败，请稍后重试' };
  }

  writeLocalRevealStatus('rejected');
  return { success: true, status: 'rejected' };
};

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
