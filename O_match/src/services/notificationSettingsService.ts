import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const NOTIFICATION_SETTINGS_KEY = 'stitch_o_match_notification_settings';

export interface NotificationSettings {
  halfHourCountdownReminder: boolean;
  matchResultReminder: boolean;
}

export const defaultNotificationSettings: NotificationSettings = {
  halfHourCountdownReminder: true,
  matchResultReminder: true,
};

const readLocalSettings = (): NotificationSettings => {
  const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
  if (!raw) {
    return defaultNotificationSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      halfHourCountdownReminder:
        parsed.halfHourCountdownReminder ?? defaultNotificationSettings.halfHourCountdownReminder,
      matchResultReminder:
        parsed.matchResultReminder ?? defaultNotificationSettings.matchResultReminder,
    };
  } catch {
    return defaultNotificationSettings;
  }
};

const writeLocalSettings = (settings: NotificationSettings) => {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
};

export const loadNotificationSettings = async (): Promise<NotificationSettings> => {
  const local = readLocalSettings();

  if (!hasSupabaseConfig || !supabase) {
    return local;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return local;
  }

  const { data, error } = await supabase
    .from('privacy_settings')
    .select('allow_messages, allow_match')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error || !data) {
    return local;
  }

  const remote: NotificationSettings = {
    halfHourCountdownReminder: data.allow_messages ?? defaultNotificationSettings.halfHourCountdownReminder,
    matchResultReminder: data.allow_match ?? defaultNotificationSettings.matchResultReminder,
  };

  writeLocalSettings(remote);
  return remote;
};

export const saveNotificationSettings = async (
  settings: NotificationSettings
): Promise<{ success: boolean; message?: string }> => {
  writeLocalSettings(settings);

  if (!hasSupabaseConfig || !supabase) {
    return { success: true };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { success: false, message: '登录状态失效，请重新登录' };
  }

  const { error } = await supabase
    .from('privacy_settings')
    .upsert(
      {
        user_id: userData.user.id,
        allow_messages: settings.halfHourCountdownReminder,
        allow_match: settings.matchResultReminder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    return { success: false, message: '同步到云端失败，请稍后重试' };
  }

  return { success: true };
};
