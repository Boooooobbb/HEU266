import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerWithEmailCode, sendRegisterEmailCode } from '@/services/authService';
import { PASSWORD_RULE_MESSAGE, isValidPassword } from '@/utils/password';

const HRBEU_EMAIL_MESSAGE = '仅支持 HEU 校园邮箱';
const HRBEU_EMAIL_SUFFIX = '@hrbeu.edu.cn';
const EMAIL_CODE_COOLDOWN_SECONDS = 30;

const isRateLimitedError = (message?: string) =>
  Boolean(message && (message.includes('过于频繁') || message.toLowerCase().includes('rate')));

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    if (codeCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCodeCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  const normalizeEmailPrefix = (value: string) => value.trim().toLowerCase().replace(/@hrbeu\.edu\.cn$/i, '');

  const buildHrbeuEmail = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return prefix ? `${prefix}${HRBEU_EMAIL_SUFFIX}` : '';
  };

  const validateHrbeuEmailPrefix = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return Boolean(prefix) && !prefix.includes('@');
  };

  const handleSendCode = async () => {
    setError('');
    setHint('');

    const normalizedEmailPrefix = normalizeEmailPrefix(emailPrefix);
    if (!normalizedEmailPrefix) {
      setError('请先填写邮箱前缀');
      return;
    }

    if (!validateHrbeuEmailPrefix(normalizedEmailPrefix)) {
      setError(HRBEU_EMAIL_MESSAGE);
      return;
    }

    if (codeCooldown > 0 || sendingCode) {
      return;
    }

    setSendingCode(true);
    setCodeCooldown(EMAIL_CODE_COOLDOWN_SECONDS);
    try {
      const result = await sendRegisterEmailCode(buildHrbeuEmail(normalizedEmailPrefix));
      if (result.success) {
        setHint(result.message || '验证码已发送，请前往邮箱查收');
      } else {
        const message = result.message || '验证码发送失败';
        setError(message);
        if (!isRateLimitedError(message)) {
          setCodeCooldown(0);
        }
      }
    } catch {
      setError('验证码发送失败，请稍后重试');
      setCodeCooldown(0);
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');

    const normalizedEmailPrefix = normalizeEmailPrefix(emailPrefix);
    if (!validateHrbeuEmailPrefix(normalizedEmailPrefix)) {
      setError(HRBEU_EMAIL_MESSAGE);
      return;
    }

    if (!code.trim()) {
      setError('请输入邮箱验证码');
      return;
    }

    // 验证密码
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!isValidPassword(password)) {
      setError(PASSWORD_RULE_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      // 使用邮箱前缀作为用户名
      const username = normalizedEmailPrefix;
      const email = buildHrbeuEmail(normalizedEmailPrefix);
      const result = await registerWithEmailCode({
        username,
        password,
        email,
        code: code.trim(),
      });

      if (result.success) {
        navigate('/bind-info');
      } else {
        setError(result.message || '注册失败');
      }
    } catch (err) {
      setError('注册失败，请稍后重试');
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
            <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight mb-2">注册账号</h1>
          </div>

          {/* Form Body */}
          <form className="w-full space-y-6 text-left" onSubmit={handleRegister}>
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">校园邮箱</label>
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

            {/* Verification Code Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">验证码</label>
              <div className="relative group">
                <input
                  className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 pr-32 text-on-surface placeholder:text-outline/40 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 ghost-border"
                  placeholder="请输入验证码"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-primary uppercase tracking-wider disabled:text-outline/60"
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode || codeCooldown > 0}
                >
                  {codeCooldown > 0 ? `${codeCooldown}s后重发` : sendingCode ? '发送中...' : '获取验证码'}
                </button>
              </div>
            </div>

            {/* Set Password Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">设置密码</label>
              <div className="relative group">
                <input
                  className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 pr-20 text-on-surface placeholder:text-outline/40 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 ghost-border"
                  placeholder="密码"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
              <p className="text-xs text-on-surface-variant ml-4">{PASSWORD_RULE_MESSAGE}</p>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">确认密码</label>
              <div className="relative group">
                <input
                  className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 pr-20 text-on-surface placeholder:text-outline/40 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 ghost-border"
                  placeholder="确认密码"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                  title={showConfirmPassword ? '隐藏密码' : '显示密码'}
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    {showConfirmPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            {hint && (
              <div className="text-green-600 text-sm text-center">{hint}</div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full sunset-gradient text-white font-bold py-5 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? '注册中...' : '开启我的灵魂之旅'} <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </button>
          </form>

          {/* Bottom Guide */}
          <div className="pt-8 border-t border-orange-100/30 w-full mt-10">
            <p className="text-[12px] text-on-surface-variant/60 leading-relaxed mb-6">
              注册即代表同意 <Link className="text-primary hover:underline underline-offset-4" to="/terms">《服务条款》</Link> 与 <Link className="text-primary hover:underline underline-offset-4" to="/privacy">《隐私政策》</Link>
            </p>
            <p className="text-sm font-medium text-on-surface-variant">
              已有账号？<Link to="/login" className="text-secondary font-bold hover:opacity-80 transition-opacity ml-1">立即登录</Link>
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

export default RegisterPage;