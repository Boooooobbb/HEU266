import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from '@/services/authService';

const HRBEU_EMAIL_SUFFIX = '@hrbeu.edu.cn';
const HRBEU_EMAIL_MESSAGE = '仅支持 HEU 校园邮箱';
const EMAIL_COOLDOWN_SECONDS = 30;

const isRateLimitedError = (message?: string) =>
  Boolean(message && (message.includes('过于频繁') || message.toLowerCase().includes('rate')));

const ForgotPasswordPage: React.FC = () => {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = React.useRef<number | null>(null);

  const clearCooldownTimer = () => {
    if (cooldownTimerRef.current) {
      window.clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  const startCooldown = (seconds = EMAIL_COOLDOWN_SECONDS) => {
    setCooldownSeconds(seconds);
    clearCooldownTimer();
    cooldownTimerRef.current = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearCooldownTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetCooldown = () => {
    clearCooldownTimer();
    setCooldownSeconds(0);
  };

  const normalizeEmailPrefix = (value: string) => value.trim().toLowerCase().replace(/@hrbeu\.edu\.cn$/i, '');

  const buildHrbeuEmail = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return prefix ? `${prefix}${HRBEU_EMAIL_SUFFIX}` : '';
  };

  const validateHrbeuEmailPrefix = (value: string) => {
    const prefix = normalizeEmailPrefix(value);
    return Boolean(prefix) && !prefix.includes('@');
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');

    if (cooldownSeconds > 0) {
      setError(`请在 ${cooldownSeconds} 秒后重新发送`);
      return;
    }

    const normalizedPrefix = normalizeEmailPrefix(emailPrefix);
    if (!validateHrbeuEmailPrefix(normalizedPrefix)) {
      setError(HRBEU_EMAIL_MESSAGE);
      return;
    }

    setLoading(true);
    startCooldown();
    try {
      const result = await sendPasswordResetEmail(buildHrbeuEmail(normalizedPrefix));
      if (result.success) {
        setHint(result.message || '重置密码邮件已发送，请前往邮箱查收');
      } else {
        const message = result.message || '发送失败';
        setError(message);
        if (!isRateLimitedError(message)) {
          resetCooldown();
        }
      }
    } catch {
      setError('发送失败，请稍后重试');
      resetCooldown();
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    return () => {
      clearCooldownTimer();
    };
  }, []);

  return (
    <div className="bg-surface min-h-screen flex flex-col items-center justify-center relative selection:bg-primary-fixed selection:text-primary-fixed">
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] warm-glow rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] warm-glow rounded-full pointer-events-none opacity-60" />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="text-3xl font-black text-orange-700 tracking-tighter flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 pointer-events-auto">
            <span>🍊</span>
            <span>意配</span>
          </Link>
        </div>
      </div>

      <main className="w-full max-w-lg px-6 relative z-10 py-24">
        <div className="glass-card rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] flex flex-col items-center text-center">
          <div className="mb-10 w-full">
            <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight mb-2">找回密码</h1>
            <p className="text-on-surface-variant text-sm">输入校园邮箱，系统会发送重置密码邮件</p>
          </div>

          <form className="w-full space-y-6 text-left" onSubmit={handleSendResetEmail}>
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

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            {hint && <div className="text-green-600 text-sm text-center">{hint}</div>}

            <button
              type="submit"
              disabled={loading || cooldownSeconds > 0}
              className="w-full sunset-gradient text-white font-bold py-5 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {cooldownSeconds > 0
                ? `重新发送（${cooldownSeconds}s）`
                : loading
                  ? '发送中...'
                  : '发送重置邮件'}
              <span className="material-symbols-outlined text-[20px]">mail</span>
            </button>
          </form>

          <div className="pt-8 border-t border-orange-100/30 w-full mt-10 flex items-center justify-between gap-4 text-sm font-medium text-on-surface-variant">
            <Link to="/login" className="text-secondary font-bold hover:opacity-80 transition-opacity">返回登录</Link>
            <Link to="/register" className="text-secondary font-bold hover:opacity-80 transition-opacity">去注册</Link>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none">
        <div className="w-full h-full opacity-30 blur-[80px] bg-gradient-to-t from-orange-400 to-transparent" />
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
