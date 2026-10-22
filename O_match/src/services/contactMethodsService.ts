import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/services/authService';

const LOCAL_CONTACT_METHODS_KEY = 'stitch_o_match_contact_methods';

export type ContactPlatform = 'wechat' | 'qq' | 'douyin';

export interface ContactMethod {
  platform: ContactPlatform;
  value: string;
  enabled: boolean;
}

const DEFAULT_METHODS: ContactMethod[] = [
  { platform: 'wechat', value: '', enabled: true },
  { platform: 'qq', value: '', enabled: true },
  { platform: 'douyin', value: '', enabled: false },
];

const normalizeMethods = (methods?: Partial<ContactMethod>[]): ContactMethod[] => {
  const map = new Map<ContactPlatform, ContactMethod>();

  DEFAULT_METHODS.forEach((item) => {
    map.set(item.platform, { ...item });
  });

  (methods || []).forEach((item) => {
    if (!item.platform || !map.has(item.platform)) return;

    map.set(item.platform, {
      platform: item.platform,
      value: (item.value || '').trim(),
      enabled: item.enabled ?? true,
    });
  });

  return Array.from(map.values());
};

const readLocalMethods = (): ContactMethod[] => {
  const raw = localStorage.getItem(LOCAL_CONTACT_METHODS_KEY);
  if (!raw) {
    return DEFAULT_METHODS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ContactMethod>[];
    return normalizeMethods(parsed);
  } catch {
    return DEFAULT_METHODS;
  }
};

const writeLocalMethods = (methods: ContactMethod[]) => {
  localStorage.setItem(LOCAL_CONTACT_METHODS_KEY, JSON.stringify(normalizeMethods(methods)));
};

const getAuthedUserId = async (): Promise<string | null> => {
  if (!hasSupabaseConfig || !supabase) return null;

  const user = await getCurrentUser();
  return user?.id ?? null;
};

export const loadContactMethods = async (): Promise<ContactMethod[]> => {
  const local = readLocalMethods();

  if (!hasSupabaseConfig || !supabase) {
    return local;
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return local;
  }

  const { data, error } = await supabase
    .from('user_contact_methods')
    .select('platform, contact_value, enabled')
    .eq('user_id', userId);

  if (error || !data) {
    return local;
  }

  const remote = normalizeMethods(
    data.map((item) => ({
      platform: item.platform as ContactPlatform,
      value: item.contact_value,
      enabled: item.enabled,
    }))
  );

  writeLocalMethods(remote);
  return remote;
};

export const saveContactMethods = async (
  methods: ContactMethod[]
): Promise<{ success: boolean; message?: string }> => {
  const normalized = normalizeMethods(methods);
  writeLocalMethods(normalized);

  if (!hasSupabaseConfig || !supabase) {
    return { success: true };
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return { success: false, message: '请先登录后再保存联系方式' };
  }

  const upsertPayload = normalized.map((item) => ({
    user_id: userId,
    platform: item.platform,
    contact_value: item.value,
    enabled: item.enabled,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('user_contact_methods')
    .upsert(upsertPayload, { onConflict: 'user_id,platform' });

  if (error) {
    return { success: false, message: '保存失败，请稍后重试' };
  }

  return { success: true };
};

export const getEnabledContactMethods = async (): Promise<ContactMethod[]> => {
  const methods = await loadContactMethods();
  return methods.filter((item) => item.enabled && item.value.trim());
};
