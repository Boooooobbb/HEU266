import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '@/services/authService';
import { PASSWORD_RULE_MESSAGE, isValidPassword } from '@/utils/password';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setChecking(false);
      return;
    }

    const client = supabase;
    let cancelled = false;

    const verifySession = async () => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (cancelled) return;

      if (sessionError || !data.session) {
        setError('密码重置链接已失效，请重新获取');
        window.setTimeout(() => {
          if (!cancelled) navigate('/forgot-password', { replace: true });
        }, 1500);
        return;
      }

      setChecking(false);
    };

    verifySession();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');

    if (!password || !confirmPassword) {
      setError('请先输入新密码');
      return;
    }

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
      const result = await resetPassword(password);
      if (result.success) {
        setHint(result.message || '密码已更新');
        window.setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1200);
      } else {
        setError(result.message || '重置失败');
      }
    } catch {
      setError('重置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="glass-card ghost-border rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06)] flex flex-col items-center text-center">
          <div className="mb-10 w-full">
            <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight mb-2">重设密码</h1>
            <p className="text-on-surface-variant text-sm">输入新密码完成修改</p>
          </div>

          {checking && (
            <div className="text-on-surface-variant text-sm animate-pulse">验证身份中...</div>
          )}

          {!checking && (
          <form className="w-full space-y-6 text-left" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-4">新密码</label>
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
                  <span className="material-symbols-outlined text-[20px] leading-none">{showPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              <p className="text-xs text-on-surface-variant ml-4">{PASSWORD_RULE_MESSAGE}</p>
            </div>

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
                  <span className="material-symbols-outlined text-[20px] leading-none">{showConfirmPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
            </div>

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            {hint && <div className="text-green-600 text-sm text-center">{hint}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full sunset-gradient text-white font-bold py-5 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? '提交中...' : '更新密码'} <span className="material-symbols-outlined text-[20px]">lock_reset</span>
            </button>
          </form>
          )}

          <div className="pt-8 border-t border-orange-100/30 w-full mt-10">
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none">
        <div className="w-full h-full opacity-30 blur-[80px] bg-gradient-to-t from-orange-400 to-transparent" />
      </div>
    </div>
  );
};

export default ResetPasswordPage;
