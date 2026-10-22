import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { deleteAccount } from '@/services/authService';

const DELETE_CONFIRM_WORD = '我已了解风险，确认注销';

const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ackRisk, setAckRisk] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = () => {
    setIsDeleteModalOpen(true);
    setAckRisk(false);
    setConfirmText('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (!ackRisk) {
      setDeleteError('请先勾选已了解风险');
      return;
    }

    if (confirmText.trim() !== DELETE_CONFIRM_WORD) {
      setDeleteError(`请输入“${DELETE_CONFIRM_WORD}”以确认`);
      return;
    }

    const finalConfirm = window.confirm('此操作不可恢复，确定要永久注销账号吗？');
    if (!finalConfirm) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.success) {
        setDeleteError(result.message || '注销失败，请稍后重试');
        return;
      }

      setIsDeleteModalOpen(false);
      navigate('/', { replace: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      setDeleteError('注销失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="pt-12 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2">安全设置</h1>
        <p className="text-on-surface-variant font-medium">保护你的账号安全与隐私</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Account Security Section */}
        <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
          <h2 className="font-headline text-xl font-bold text-on-surface px-2 mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">security</span>
            账号安全
          </h2>
          <div className="space-y-4">
            {/* Change Password */}
            <button
              onClick={() => navigate('/change-password')}
              className="w-full flex items-center p-4 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-2xl group text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">修改密码</div>
                <div className="text-on-surface-variant text-sm">先验证校园邮箱，再进入密码重设</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            {/* Bind Phone */}
            <button className="w-full flex items-center p-4 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-2xl group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">smartphone</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">绑定手机</div>
                <div className="text-on-surface-variant text-sm">用于找回密码与通知</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            {/* Bind WeChat */}
            <button className="w-full flex items-center p-4 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-2xl group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>chat_bubble</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">绑定微信</div>
                <div className="text-on-surface-variant text-sm">用于匹配成功后联系</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] border border-error/20">
          <h2 className="font-headline text-xl font-bold text-error px-2 mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-error">warning</span>
            危险操作
          </h2>
          <div className="space-y-4">
            {/* Delete Account */}
            <button
              onClick={openDeleteModal}
              className="w-full flex items-center p-4 bg-error-container/30 hover:bg-error-container/50 transition-all duration-300 rounded-2xl group text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center text-error shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold text-error">注销账号</div>
                <div className="text-on-surface-variant text-sm">永久删除账号与所有数据</div>
              </div>
              <span className="material-symbols-outlined text-error group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 px-8 py-4 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-full text-on-surface-variant font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          返回个人资料
        </button>
      </div>

      {isDeleteModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[2rem] p-6 md:p-8 bg-white border border-zinc-200 shadow-[0_20px_48px_rgba(28,28,24,0.35)]">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-zinc-900">确认注销账号</h3>
                <p className="text-sm text-zinc-700 mt-1 leading-relaxed">该操作会永久删除你的账号与相关数据，且无法恢复。</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 text-sm text-zinc-700 bg-red-50 border border-red-100 rounded-2xl p-3">
                <input
                  type="checkbox"
                  checked={ackRisk}
                  onChange={(e) => setAckRisk(e.target.checked)}
                  className="mt-0.5 accent-red-500 w-4 h-4"
                  disabled={deleting}
                />
                <span>我已了解：账号注销后，问卷、匹配与聊天记录将无法找回。</span>
              </label>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-700 ml-1">输入确认词</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={DELETE_CONFIRM_WORD}
                  disabled={deleting}
                  className="w-full mt-2 bg-white border border-zinc-300 rounded-2xl py-3 px-4 text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all duration-200"
                />
              </div>

              {deleteError && <div className="text-sm text-red-600 font-medium">{deleteError}</div>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full bg-zinc-100 text-zinc-700 font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-6 py-2.5 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? '注销中...' : '确认注销'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
};

export default SecurityPage;
