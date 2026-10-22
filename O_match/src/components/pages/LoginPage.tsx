import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '@/services/authService';
import { getQuestionnaireSnapshot, loadQuestionnaire } from '@/services/questionnaireService';
import { resolveQuestionnaireModulePath } from '@/utils/questionnaireProgress';

const HRBEU_EMAIL_SUFFIX = '@hrbeu.edu.cn';
const HRBEU_EMAIL_MESSAGE = '仅支持 HEU 校园邮箱';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeEmailPrefix = (value: string) => value.trim().toLowerCase().replace(/@hrbeu\.edu\.cn$/i, '');

  const validateHrbeuEmailPrefix = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return Boolean(prefix) && !prefix.includes('@');
  };

  const buildHrbeuEmail = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return prefix ? `${prefix}${HRBEU_EMAIL_SUFFIX}` : '';
  };

  const resolvePostLoginPath = () => resolveQuestionnaireModulePath(getQuestionnaireSnapshot());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedPrefix = normalizeEmailPrefix(emailPrefix);
    if (!validateHrbeuEmailPrefix(normalizedPrefix)) {
      setError(HRBEU_EMAIL_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const username = normalizedPrefix;
      const email = buildHrbeuEmail(normalizedPrefix);
      const result = await login({ username, email, password });

      if (result.success) {
        // Do not block navigation on remote questionnaire hydration.
        const targetPath = resolvePostLoginPath();
        void loadQuestionnaire();
        navigate(targetPath, { replace: true });
      } else {
        setError(result.message || '登录失败');
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen flex flex-col items-center justify-center relative selection:bg-primary-fixed selection:text-primary-fixed">
      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] warm-glow rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] warm-glow rounded-full pointer-events-none opacity-60" />

      {/* Top Navigation / Branding */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="text-3xl font-black text-orange-700 tracking-tighter flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 pointer-events-auto">
            <span>🍊</span>
            <span>意配</span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="w-full max-w-lg px-6 relative z-10 py-24">
        <div className="glass-card rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] flex flex-col items-center text-center">
          {/* Header Section */}
          <div className="mb-10 w-full">
            <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight mb-2">欢迎回来</h1>
            <p className="text-on-surface-variant text-sm">登录以继续你的灵魂之旅</p>
          </div>

          {/* Form Body */}
          <form className="w-full space-y-6 text-left" onSubmit={handleLogin}>
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">
                校园邮箱
              </label>
              <div className="relative group flex items-stretch overflow-hidden rounded-2xl ghost-border bg-surface-container-low transition-all duration-300 focus-within:bg-surface-container-lowest">
                <input
                  className="min-w-0 flex-1 bg-transparent border-none py-4 px-6 text-on-surface placeholder:text-outline/40 focus:ring-0 focus:outline-none"
                  placeholder="邮箱"
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                />
                <div className="flex items-center px-4 text-[15px] font-bold text-on-surface-variant whitespace-nowrap">
                  <span className="text-[22px] leading-none mr-0.5" style={{ fontFamily: '"Avenir Next", "Futura", "Helvetica Neue", "PingFang SC", sans-serif', fontWeight: 500 }}>@</span>
                  <span>hrbeu.edu.cn</span>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">
                登录密码
              </label>
              <div className="relative group">
                <input
                  className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 text-on-surface placeholder:text-outline/40 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 ghost-border"
                  placeholder="密码"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            {/* Forgot Password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-[12px] text-primary hover:underline">
                忘记密码？
              </Link>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full sunset-gradient text-white font-bold py-5 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? '登录中...' : '开启我的灵魂之旅'} <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </button>
          </form>

          {/* Bottom Guide */}
          <div className="pt-8 border-t border-orange-100/30 w-full mt-10">
            <p className="text-sm font-medium text-on-surface-variant">
              还没有账号？<Link to="/register" className="text-secondary font-bold hover:opacity-80 transition-opacity ml-1">立即注册</Link>
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Aesthetic Glow */}
      <div className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none">
        <div className="w-full h-full opacity-30 blur-[80px] bg-gradient-to-t from-orange-400 to-transparent" />
      </div>
    </div>
  );
};

export default LoginPage;