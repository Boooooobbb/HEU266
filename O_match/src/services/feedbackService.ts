import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const LOCAL_FEEDBACK_KEY = 'stitch_o_match_feedback_tickets';

export type FeedbackType = '问题反馈' | '功能建议' | '体验优化' | '其他';

export interface SubmitFeedbackInput {
  type: FeedbackType;
  content: string;
  contact?: string;
  sourcePath?: string;
}

export interface FeedbackTicket {
  id: string;
  user_id: string | null;
  user_email: string | null;
  type: FeedbackType;
  content: string;
  contact: string | null;
  source_path: string | null;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
}

export interface SubmitFeedbackResult {
  success: boolean;
  message?: string;
  ticketId?: string;
}

const safeTrim = (value?: string) => (value || '').trim();

const normalizeFeedbackType = (value: string): FeedbackType => {
  const allowed: FeedbackType[] = ['问题反馈', '功能建议', '体验优化', '其他'];
  if (allowed.includes(value as FeedbackType)) {
    return value as FeedbackType;
  }
  return '问题反馈';
};

const readLocalTickets = (): FeedbackTicket[] => {
  const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as FeedbackTicket[];
  } catch {
    return [];
  }
};

const writeLocalTickets = (tickets: FeedbackTicket[]) => {
  localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(tickets));
};

const createLocalTicket = (payload: SubmitFeedbackInput): FeedbackTicket => {
  const now = new Date().toISOString();
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: null,
    user_email: null,
    type: normalizeFeedbackType(payload.type),
    content: safeTrim(payload.content),
    contact: safeTrim(payload.contact) || null,
    source_path: safeTrim(payload.sourcePath) || null,
    status: 'open',
    created_at: now,
  };
};

export const submitFeedbackTicket = async (
  payload: SubmitFeedbackInput
): Promise<SubmitFeedbackResult> => {
  const content = safeTrim(payload.content);
  if (!content) {
    return { success: false, message: '请先填写反馈内容' };
  }

  const normalizedPayload: SubmitFeedbackInput = {
    type: normalizeFeedbackType(payload.type),
    content,
    contact: safeTrim(payload.contact),
    sourcePath: safeTrim(payload.sourcePath),
  };

  if (!hasSupabaseConfig || !supabase) {
    const tickets = readLocalTickets();
    const ticket = createLocalTicket(normalizedPayload);
    writeLocalTickets([ticket, ...tickets]);
    return { success: true, message: '反馈已提交（本地开发模式）', ticketId: ticket.id };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { success: false, message: '请先登录后再提交反馈' };
  }

  const { data, error } = await supabase
    .from('feedback_tickets')
    .insert({
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
      type: normalizedPayload.type,
      content: normalizedPayload.content,
      contact: normalizedPayload.contact || null,
      source_path: normalizedPayload.sourcePath || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, message: '提交失败，请稍后重试' };
  }

  return {
    success: true,
    message: '反馈提交成功，感谢你的建议',
    ticketId: data?.id,
  };
};
