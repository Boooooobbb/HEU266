import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getCurrentUser as getAuthCurrentUser } from '@/services/authService';

const LOCAL_NOTIFICATIONS_KEY = 'stitch_o_match_notifications';
const LOCAL_NOTIFICATION_EVENT = 'notification-updated';

export type NotificationKind = 'pre_reveal' | 'match_result' | 'system' | 'chat_message';
export type NotificationChannel = 'in_app' | 'email';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  content: string;
  linkPath: string | null;
  channel: NotificationChannel;
  isRead: boolean;
  scheduledFor: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface LocalNotificationItem extends NotificationItem {
  userId?: string;
}

const readLocalNotifications = (): LocalNotificationItem[] => {
  const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as LocalNotificationItem[];
  } catch {
    return [];
  }
};

const writeLocalNotifications = (items: LocalNotificationItem[]) => {
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(items));
};

const dispatchLocalNotificationUpdate = () => {
  window.dispatchEvent(new Event(LOCAL_NOTIFICATION_EVENT));
};

const normalizeItem = (item: Partial<NotificationItem>): NotificationItem => {
  return {
    id: item.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: (item.kind as NotificationKind) || 'system',
    title: (item.title || '').trim() || '系统通知',
    content: (item.content || '').trim() || '',
    linkPath: item.linkPath || null,
    channel: (item.channel as NotificationChannel) || 'in_app',
    isRead: Boolean(item.isRead),
    scheduledFor: item.scheduledFor || null,
    deliveredAt: item.deliveredAt || null,
    createdAt: item.createdAt || new Date().toISOString(),
  };
};

const mapRemoteItem = (row: {
  id: string;
  kind: string;
  title: string;
  content: string;
  link_path: string | null;
  channel: string;
  is_read: boolean;
  scheduled_for: string | null;
  delivered_at: string | null;
  created_at: string;
}): NotificationItem => {
  return {
    id: row.id,
    kind: (row.kind as NotificationKind) || 'system',
    title: row.title,
    content: row.content,
    linkPath: row.link_path,
    channel: (row.channel as NotificationChannel) || 'in_app',
    isRead: Boolean(row.is_read),
    scheduledFor: row.scheduled_for,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  };
};

const getCurrentUserId = async (): Promise<string | null> => {
  const currentUser = await getAuthCurrentUser();
  if (currentUser?.id) {
    return currentUser.id;
  }

  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
};

export const addLocalNotificationForUser = async (
  userId: string,
  notification: Partial<NotificationItem>
): Promise<void> => {
  const nextItem = {
    ...normalizeItem(notification),
    userId,
  } as LocalNotificationItem;

  const current = readLocalNotifications();
  current.push(nextItem);
  writeLocalNotifications(current);
  dispatchLocalNotificationUpdate();
};

export const loadNotifications = async (limit = 20): Promise<NotificationItem[]> => {
  const local = readLocalNotifications();

  const currentUserId = await getCurrentUserId();
  const localForCurrentUser = currentUserId
    ? local.filter((item) => item.userId === currentUserId || !item.userId)
    : local;

  if (!hasSupabaseConfig || !supabase) {
    return localForCurrentUser.map(normalizeItem).slice(0, limit);
  }

  if (!currentUserId) {
    return localForCurrentUser.map(normalizeItem).slice(0, limit);
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, content, link_path, channel, is_read, scheduled_for, delivered_at, created_at')
    .eq('user_id', currentUserId)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return localForCurrentUser.map(normalizeItem).slice(0, limit);
  }

  const remote = data.map(mapRemoteItem);
  return [...localForCurrentUser.map(normalizeItem), ...remote].slice(0, limit);
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const local = readLocalNotifications();
  const userId = await getCurrentUserId();
  const localUnread = userId
    ? local.filter((item) => (item.userId === userId || !item.userId) && !item.isRead).length
    : local.filter((item) => !item.isRead).length;

  if (!hasSupabaseConfig || !supabase) {
    return localUnread;
  }

  if (!userId) {
    return localUnread;
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .eq('is_read', false);

  if (error) {
    return localUnread;
  }

  return (count ?? 0) + localUnread;
};

export const markLocalNotificationsReadForCurrentUserByKind = async (
  kind: NotificationKind
): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return;
  }

  const current = readLocalNotifications();
  const next = current.map((item) => {
    if (item.userId !== userId || item.kind !== kind) {
      return item;
    }

    return {
      ...item,
      isRead: true,
    };
  });

  writeLocalNotifications(next);
  dispatchLocalNotificationUpdate();
};

export const markNotificationRead = async (
  notificationId: string
): Promise<{ success: boolean; message?: string }> => {
  const local = readLocalNotifications();
  const nextLocal = local.map((item) => {
    if (item.id !== notificationId) {
      return item;
    }

    return {
      ...item,
      isRead: true,
    };
  });
  writeLocalNotifications(nextLocal);
  dispatchLocalNotificationUpdate();

  if (!hasSupabaseConfig || !supabase) {
    return { success: true };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, message: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .eq('channel', 'in_app');

  if (error) {
    return { success: false, message: '标记已读失败，请稍后重试' };
  }

  return { success: true };
};

export const markAllNotificationsRead = async (): Promise<{ success: boolean; message?: string }> => {
  const now = new Date().toISOString();
  const local = readLocalNotifications();
  writeLocalNotifications(local.map((item) => ({ ...item, isRead: true, deliveredAt: item.deliveredAt || now })));
  dispatchLocalNotificationUpdate();

  if (!hasSupabaseConfig || !supabase) {
    return { success: true };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, message: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now })
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .eq('is_read', false);

  if (error) {
    return { success: false, message: '全部已读操作失败，请稍后重试' };
  }

  return { success: true };
};
