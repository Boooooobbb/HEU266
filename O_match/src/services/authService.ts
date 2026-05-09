import type { User } from '@/types';
import { useAuthStore } from '@/store/auth';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { resetQuestionnaireSessionCache } from './questionnaireService';

const AUTH_STORAGE_KEY = 'stitch_o_match_auth';
const TOKEN_STORAGE_KEY = 'stitch_o_match_token';
const USER_STORAGE_KEY = 'stitch_o_match_user';
const OTP_STORAGE_KEY = 'stitch_o_match_register_otp';
const INVALID_CREDENTIAL_MESSAGE = '账号或密码错误';
const HRBEU_EMAIL_SUFFIX = '@hrbeu.edu.cn';
const HRBEU_EMAIL_MESSAGE = '仅支持 HEU 校园邮箱';
const RESET_PASSWORD_COOLDOWN_MESSAGE = '发送过于频繁，请稍后再试';
const RESET_PASSWORD_SAME_AS_OLD_MESSAGE = '新密码不能与旧密码相同，请换一个新密码';
const PASSWORD_POLICY_MESSAGE = '密码不符合要求，请重新设置';
const CURRENT_USER_CACHE_TTL_MS = 5000;

let currentUserCache: { user: User | null; expiresAt: number } | null = null;
let currentUserPromise: Promise<User | null> | null = null;

const normalizeResetPasswordError = (message?: string): string => {
  if (!message) {
    return '发送失败，请稍后重试';
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('same as the old password') ||
    normalized.includes('same as old password') ||
    normalized.includes('should be different from the old password') ||
    normalized.includes('password should be different') ||
    normalized.includes('new password cannot be the same') ||
    normalized.includes('identical to the old password')
  ) {
    return RESET_PASSWORD_SAME_AS_OLD_MESSAGE;
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('over_email_send_rate') ||
    normalized.includes('email send rate') ||
    normalized.includes('security purposes')
  ) {
    return RESET_PASSWORD_COOLDOWN_MESSAGE;
  }

  return '发送失败，请稍后重试';
};

const normalizePasswordUpdateError = (message?: string): string => {
  if (!message) {
    return '重置失败，请稍后重试';
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('same as the old password') ||
    normalized.includes('same as old password') ||
    normalized.includes('should be different from the old password') ||
    normalized.includes('password should be different') ||
    normalized.includes('new password cannot be the same') ||
    normalized.includes('identical to the old password')
  ) {
    return RESET_PASSWORD_SAME_AS_OLD_MESSAGE;
  }

  if (
    normalized.includes('password should be at least') ||
    normalized.includes('password is too short') ||
    normalized.includes('password too short') ||
    normalized.includes('weak password') ||
    normalized.includes('password strength') ||
    normalized.includes('validation failed') ||
    normalized.includes('must be at least')
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }

  return '重置失败，请稍后重试';
};

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
}

export interface LoginData {
  username?: string;
  email?: string;
  password: string;
}

export interface RegisterWithCodeData extends RegisterData {
  code: string;
}

export interface SendCodeResult {
  success: boolean;
  message?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  message?: string;
}

export interface DeleteAccountResult {
  success: boolean;
  message?: string;
}

interface MockStoredUser {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
}

interface MockOtpRecord {
  email: string;
  code: string;
  expiresAt: number;
}

const isInvalidCredentialError = (message?: string): boolean => {
  if (!message) return false;

  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('wrong password') ||
    normalized.includes('用户名或密码错误') ||
    normalized.includes('账号或密码错误') ||
    normalized.includes('密码错误') ||
    normalized.includes('用户不存在')
  );
};

const mapAuthUser = (authUser: {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string;
}): User => {
  const metadata = authUser.user_metadata ?? {};
  const nickname = typeof metadata.nickname === 'string'
    ? metadata.nickname
    : typeof metadata.username === 'string'
      ? metadata.username
      : undefined;

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    nickname,
    createdAt: authUser.created_at ?? new Date().toISOString(),
    verified: Boolean(authUser.email_confirmed_at),
  };
};

const setClientAuth = (token: string, user: User) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  currentUserCache = { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS };
  useAuthStore.getState().setAuth(token, user);
};

const clearClientAuth = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  currentUserCache = { user: null, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS };
  currentUserPromise = null;
  useAuthStore.getState().logout();
  resetQuestionnaireSessionCache();
};

const readMockUsers = (): MockStoredUser[] => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  return stored ? JSON.parse(stored) as MockStoredUser[] : [];
};

const readMockOtps = (): MockOtpRecord[] => {
  const stored = localStorage.getItem(OTP_STORAGE_KEY);
  return stored ? JSON.parse(stored) as MockOtpRecord[] : [];
};

const writeMockOtps = (otps: MockOtpRecord[]) => {
  localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps));
};

const isHrbeuEmail = (email: string): boolean => {
  return email.toLowerCase().endsWith(HRBEU_EMAIL_SUFFIX);
};

const fallbackSendRegisterCode = async (email: string): Promise<SendCodeResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isHrbeuEmail(normalizedEmail)) {
    return { success: false, message: HRBEU_EMAIL_MESSAGE };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const otps = readMockOtps().filter((item) => item.email !== normalizedEmail && item.expiresAt > Date.now());
  otps.push({ email: normalizedEmail, code, expiresAt });
  writeMockOtps(otps);

  return {
    success: true,
    message: `本地开发模式验证码：${code}（10分钟内有效）`,
  };
};

const fallbackRegisterWithCode = async (data: RegisterWithCodeData): Promise<LoginResult> => {
  const normalizedEmail = data.email?.trim().toLowerCase() ?? '';
  if (!isHrbeuEmail(normalizedEmail)) {
    return { success: false, message: HRBEU_EMAIL_MESSAGE };
  }

  const otps = readMockOtps();
  const matchedOtp = otps.find((item) => item.email === normalizedEmail && item.code === data.code.trim());
  if (!matchedOtp) {
    return { success: false, message: '验证码错误' };
  }

  if (matchedOtp.expiresAt < Date.now()) {
    writeMockOtps(otps.filter((item) => item.email !== normalizedEmail && item.expiresAt > Date.now()));
    return { success: false, message: '验证码已过期，请重新获取' };
  }

  writeMockOtps(otps.filter((item) => item.email !== normalizedEmail && item.expiresAt > Date.now()));
  return fallbackRegister({
    ...data,
    email: normalizedEmail,
  });
};

export const sendRegisterEmailCode = async (email: string): Promise<SendCodeResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isHrbeuEmail(normalizedEmail)) {
    return { success: false, message: HRBEU_EMAIL_MESSAGE };
  }

  if (!hasSupabaseConfig || !supabase) {
    return fallbackSendRegisterCode(normalizedEmail);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: '验证码已发送，请前往邮箱查收' };
};

export const registerWithEmailCode = async (data: RegisterWithCodeData): Promise<LoginResult> => {
  const normalizedEmail = data.email?.trim().toLowerCase() ?? '';
  if (!isHrbeuEmail(normalizedEmail)) {
    return { success: false, message: HRBEU_EMAIL_MESSAGE };
  }

  if (!hasSupabaseConfig || !supabase) {
    return fallbackRegisterWithCode({
      ...data,
      email: normalizedEmail,
    });
  }

  const { data: verifyResult, error: verifyError } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: data.code.trim(),
    type: 'email',
  });

  if (verifyError) {
    return { success: false, message: verifyError.message };
  }

  if (!verifyResult.user || !verifyResult.session) {
    return { success: false, message: '验证码验证失败，请重试' };
  }

  const { data: updateResult, error: updateError } = await supabase.auth.updateUser({
    password: data.password,
    data: {
      username: data.username,
      nickname: data.nickname ?? data.username,
    },
  });

  if (updateError) {
    return { success: false, message: normalizePasswordUpdateError(updateError.message) };
  }

  const user = mapAuthUser(updateResult.user ?? verifyResult.user);
  const token = verifyResult.session.access_token;
  setClientAuth(token, user);

  return { success: true, user, token, message: '注册成功' };
};

const fallbackRegister = async (data: RegisterData): Promise<LoginResult> => {
  const users = readMockUsers();

  if (users.find((u) => u.username === data.username)) {
    return { success: false, message: '用户名已存在' };
  }

  users.push({
    username: data.username,
    password: data.password,
    email: data.email,
    nickname: data.nickname,
  });
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));

  const newUser: User = {
    id: Date.now().toString(),
    email: data.email ?? `${data.username}@example.com`,
    nickname: data.nickname || data.username,
    createdAt: new Date().toISOString(),
    verified: false,
  };

  const token = btoa(JSON.stringify({
    userId: newUser.id,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));

  setClientAuth(token, newUser);
  return { success: true, user: newUser, token };
};

const fallbackLogin = async (data: LoginData): Promise<LoginResult> => {
  const users = readMockUsers();
  const user = users.find((u) => {
    if (data.email) {
      return u.email === data.email && u.password === data.password;
    }
    return u.username === data.username && u.password === data.password;
  });

  if (!user) {
    return { success: false, message: INVALID_CREDENTIAL_MESSAGE };
  }

  const loginUser: User = {
    id: Date.now().toString(),
    email: user.email ?? `${user.username}@example.com`,
    nickname: user.nickname || user.username,
    createdAt: new Date().toISOString(),
    verified: false,
  };

  const token = btoa(JSON.stringify({
    userId: loginUser.id,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));

  setClientAuth(token, loginUser);
  return { success: true, user: loginUser, token };
};

export const register = async (data: RegisterData): Promise<LoginResult> => {
  if (!hasSupabaseConfig || !supabase) {
    return fallbackRegister(data);
  }

  if (!data.email) {
    return { success: false, message: '请填写邮箱地址' };
  }

  const { data: signUpResult, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        username: data.username,
        nickname: data.nickname ?? data.username,
      },
    },
  });

  if (error) {
    return { success: false, message: error.message };
  }

  if (!signUpResult.user) {
    return { success: false, message: '注册失败，请稍后重试' };
  }

  const user = mapAuthUser(signUpResult.user);
  const token = signUpResult.session?.access_token ?? '';

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  if (token) {
    setClientAuth(token, user);
  } else {
    useAuthStore.getState().setUser(user);
  }

  return {
    success: true,
    user,
    token,
    message: token ? '注册成功' : '注册成功，请前往邮箱完成验证',
  };
};

export const login = async (data: LoginData): Promise<LoginResult> => {
  if (!hasSupabaseConfig || !supabase) {
    return fallbackLogin(data);
  }

  const email = data.email;
  if (!email) {
    return { success: false, message: '请使用邮箱登录' };
  }

  const { data: signInResult, error } = await supabase.auth.signInWithPassword({
    email,
    password: data.password,
  });

  if (error) {
    if (isInvalidCredentialError(error.message)) {
      return { success: false, message: INVALID_CREDENTIAL_MESSAGE };
    }
    return { success: false, message: error.message };
  }

  if (!signInResult.user || !signInResult.session) {
    return { success: false, message: '登录失败，请稍后重试' };
  }

  const user = mapAuthUser(signInResult.user);
  const token = signInResult.session.access_token;
  setClientAuth(token, user);

  return { success: true, user, token };
};

export const logout = async (): Promise<void> => {
  if (hasSupabaseConfig && supabase) {
    await supabase.auth.signOut();
  }
  clearClientAuth();
};

export const sendPasswordResetEmail = async (email: string): Promise<SendCodeResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isHrbeuEmail(normalizedEmail)) {
    return { success: false, message: HRBEU_EMAIL_MESSAGE };
  }

  if (!hasSupabaseConfig || !supabase) {
    return { success: false, message: '当前开发模式未启用真实找回密码邮件，请连接 Supabase 后再使用' };
  }

  const origin = window.location.hostname === 'localhost'
    ? window.location.origin
    : window.location.origin.replace(/^http:/, 'https:');
  const redirectTo = `${origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    return { success: false, message: normalizeResetPasswordError(error.message) };
  }

  return { success: true, message: '重置密码邮件已发送，请前往邮箱查收' };
};

export const resetPassword = async (newPassword: string): Promise<ResetPasswordResult> => {
  if (!hasSupabaseConfig || !supabase) {
    return { success: false, message: '当前开发模式未启用真实密码重置功能' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, message: normalizePasswordUpdateError(error.message) };
  }

  return { success: true, message: '密码已更新' };
};

export const deleteAccount = async (): Promise<DeleteAccountResult> => {
  if (!hasSupabaseConfig || !supabase) {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.email) {
      const users = readMockUsers().filter((item) => item.email !== currentUser.email);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
    }
    clearClientAuth();
    return { success: true, message: '账号已注销' };
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    return { success: false, message: '当前登录状态已失效，请重新登录后重试' };
  }

  const { error: rpcError } = await supabase.rpc('delete_my_account');
  if (rpcError) {
    return {
      success: false,
      message: '注销失败：请先在 Supabase 中创建 delete_my_account 函数并授予 authenticated 调用权限',
    };
  }

  await supabase.auth.signOut();
  clearClientAuth();
  return { success: true, message: '账号已注销' };
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (currentUserCache && currentUserCache.expiresAt > Date.now()) {
    return currentUserCache.user;
  }

  if (currentUserPromise) {
    return currentUserPromise;
  }

  currentUserPromise = (async () => {
    if (hasSupabaseConfig && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        clearClientAuth();
        return null;
      }

      const user = mapAuthUser(data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      useAuthStore.getState().setUser(user);
      currentUserCache = { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS };
      return user;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userStr = localStorage.getItem(USER_STORAGE_KEY);

    if (!token || !userStr) {
      currentUserCache = { user: null, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS };
      return null;
    }

    try {
      const tokenData = JSON.parse(atob(token)) as { exp: number };
      if (tokenData.exp < Date.now()) {
        clearClientAuth();
        return null;
      }
    } catch {
      clearClientAuth();
      return null;
    }

    const user = JSON.parse(userStr) as User;
    currentUserCache = { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS };
    return user;
  })().finally(() => {
    currentUserPromise = null;
  });

  return currentUserPromise;
};

export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    return false;
  }

  if (hasSupabaseConfig) {
    return true;
  }

  try {
    const tokenData = JSON.parse(atob(token)) as { exp: number };
    return tokenData.exp > Date.now();
  } catch {
    return false;
  }
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};
