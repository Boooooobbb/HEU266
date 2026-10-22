import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { logout as logoutService } from '@/services/authService';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logoutService(); // 清除 localStorage
    logout(); // 清除 zustand store
    navigate('/'); // 跳转到首页
    window.scrollTo({ top: 0, behavior: 'auto' }); // 回到首页顶部
  };
  return (
    <main className="pt-32 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      {/* Profile Hero Section */}
      <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] relative overflow-hidden">

        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* User Avatar */}
          <div className="relative">
            <div className="w-32 h-32 rounded-[2rem] overflow-hidden shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500">
              <img
                alt="User Avatar"
                className="w-full h-full object-cover bg-secondary-fixed"
                src="/avatar.jpg"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary text-white p-1.5 rounded-full shadow-lg border-4 border-white">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">遇见你的校园缘分💌</h1>
            <p className="text-on-surface-variant font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
              <span className="material-symbols-outlined text-lg">mail</span>
              {user?.email || '未获取到邮箱'}
            </p>
          </div>
        </div>

        {/* Account Settings List */}
        <div className="mt-16 space-y-4">
          <h2 className="font-headline text-xl font-bold text-on-surface px-2 mb-6">账户设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Security Settings Card */}
            <Link to="/security" className="flex items-center p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">shield_person</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">安全设置</div>
                <div className="text-on-surface-variant text-sm">账号与安全</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </Link>

            {/* Notification Preferences Card */}
            <Link to="/notifications" className="flex items-center p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">notifications_active</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">通知提醒</div>
                <div className="text-on-surface-variant text-sm">推送与邮件提醒</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </Link>

            {/* Feedback Card */}
            <Link to="/feedback" className="flex items-center p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">support_agent</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">问题反馈</div>
                <div className="text-on-surface-variant text-sm">提交 Bug 与功能建议</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </Link>

            {/* Contact Methods Card */}
            <Link to="/contact-methods" className="flex items-center p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">perm_contact_calendar</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">联系方式管理</div>
                <div className="text-on-surface-variant text-sm">微信、QQ、抖音快捷交换</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </Link>

            {/* Project Donation Card */}
            <Link to="/donate" className="flex items-center p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] group text-left">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">volunteer_activism</span>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-on-surface font-bold">项目捐赠</div>
                <div className="text-on-surface-variant text-sm">支持我们的校园服务器</div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Footer Action */}
        <div className="mt-16 flex flex-col items-center gap-8">
          <button onClick={handleLogout} className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-tr from-primary to-primary-container text-white font-bold rounded-full shadow-[0_8px_32px_rgba(148,74,0,0.2)] hover:shadow-[0_12px_40px_rgba(148,74,0,0.3)] transition-all duration-300 active:scale-95">
            <span className="material-symbols-outlined">logout</span>
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </main>
  );
};

export default ProfilePage;