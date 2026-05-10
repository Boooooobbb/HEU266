import React from 'react';
import { useNavigate } from 'react-router-dom';

const DonatePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="pt-12 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2">项目捐赠</h1>
        <p className="text-on-surface-variant font-medium">感谢你的支持，让校园服务器持续运行</p>
      </div>

      {/* Donation Info */}
      <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] mb-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#07C160] to-[#09D35F] flex items-center justify-center shadow-lg shrink-0">
            <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          </div>
          <div>
            <h2 className="font-bold text-lg text-on-surface mb-1">支持我们</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              🍊意配 依靠校园服务器运行，每一笔捐赠都将用于服务器费用。你的支持是我们坚持下去的动力！
            </p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-lg">info</span>
            <span>捐赠是自愿的，不影响任何功能使用</span>
          </div>
        </div>
      </div>

      {/* QR Code Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WeChat QR Code */}
        <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#07C160] to-[#09D35F] flex items-center justify-center shadow-lg mb-6">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
          </div>
          <h3 className="font-bold text-xl text-on-surface mb-2">微信捐赠</h3>
          <p className="text-on-surface-variant text-sm mb-6">扫描下方二维码</p>

          {/* WeChat QR Code Placeholder */}
          <div className="w-48 h-48 bg-surface-container-low rounded-2xl flex items-center justify-center border-2 border-dashed border-outline-variant">
            <div className="text-center">
              <span className="material-symbols-outlined text-outline-variant text-5xl mb-2">qr_code</span>
              <p className="text-on-surface-variant text-xs">微信收款码</p>
            </div>
          </div>
        </div>

        {/* Alipay QR Code */}
        <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1677FF] to-[#1890FF] flex items-center justify-center shadow-lg mb-6">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
          </div>
          <h3 className="font-bold text-xl text-on-surface mb-2">支付宝捐赠</h3>
          <p className="text-on-surface-variant text-sm mb-6">扫描下方二维码</p>

          {/* Alipay QR Code Placeholder */}
          <div className="w-48 h-48 bg-surface-container-low rounded-2xl flex items-center justify-center border-2 border-dashed border-outline-variant">
            <div className="text-center">
              <span className="material-symbols-outlined text-outline-variant text-5xl mb-2">qr_code</span>
              <p className="text-on-surface-variant text-xs">支付宝收款码</p>
            </div>
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
    </main>
  );
};

export default DonatePage;
