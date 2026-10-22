import React from 'react';
import { useNavigate } from 'react-router-dom';

const BindInfoPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBind = (type: 'wechat' | 'phone') => {
    // TODO: 调用绑定 API
    console.log('绑定', type);
    // 绑定成功后跳转到问卷
    navigate('/questionnaire');
  };

  const handleSkip = () => {
    // 跳过绑定，跳转到问卷
    navigate('/questionnaire');
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center relative selection:bg-primary-fixed selection:text-primary-fixed">
      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] warm-glow rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] warm-glow rounded-full pointer-events-none opacity-60" />

      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] warm-glow rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[600px] h-[600px] warm-glow rounded-full pointer-events-none opacity-60" />

      {/* Main Content Area */}
      <main className="w-full max-w-lg px-6 relative z-10 py-24">
        {/* Central Floating Card */}
        <div className="glass-card rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] flex flex-col items-center text-center">
          {/* Header Section */}
          <div className="mb-10 w-full">
            <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight mb-2">绑定联系方式</h1>
            <p className="text-on-surface-variant text-sm">绑定微信或手机号，方便匹配后联系</p>
          </div>

          {/* Bind Options */}
          <div className="w-full space-y-6">
            {/* WeChat Option */}
            <button
              onClick={() => handleBind('wechat')}
              className="w-full p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-2xl flex items-center gap-4 group text-left border border-transparent hover:border-outline-variant/30"
            >
              <div className="w-14 h-14 wechat-gradient rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
              </div>
              <div className="flex-1">
                <div className="text-on-surface font-bold text-lg">微信</div>
                <span className="text-on-surface-variant text-sm">扫码绑定或搜索微信号</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="h-[1px] flex-1 bg-outline-variant/30" />
              <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">或者</span>
              <div className="h-[1px] flex-1 bg-outline-variant/30" />
            </div>

            {/* Phone Option */}
            <button
              onClick={() => handleBind('phone')}
              className="w-full p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-2xl flex items-center gap-4 group text-left border border-transparent hover:border-outline-variant/30"
            >
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-on-surface text-2xl">call</span>
              </div>
              <div className="flex-1">
                <div className="text-on-surface font-bold text-lg">手机号</div>
                <span className="text-on-surface-variant text-sm">绑定手机号接收短信通知</span>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            {/* Skip Option */}
            <div className="pt-8">
              <button
                onClick={handleSkip}
                className="text-on-surface-variant hover:text-primary font-medium text-sm transition-colors"
              >
                暂时跳过，稍后绑定
              </button>
            </div>
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

export default BindInfoPage;
