import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const HomePage: React.FC = () => {
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated);

  return (
    <>
      {/* Hero Background Gradient - Extends to top of page */}
      <div className="fixed top-0 left-0 right-0 h-[60vh] hero-gradient -z-10 pointer-events-none" />

      <main className="relative z-10 pt-28 md:pt-28 pb-44">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-[10px] md:text-xs font-bold mb-6 md:mb-8 outline outline-1 outline-orange-200/30 shadow-sm animate-fade-in-up">
            <span className="material-symbols-outlined text-[14px]">stars</span>
            HEU 专属社交实验
          </div>
          <h1 className="text-3xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-on-surface mb-6 md:mb-8 leading-[1.2] md:leading-[1.1] font-headline amber-gradient animate-fade-in-up animation-delay-100">
            也许，你们已经在 HEU <br className="hidden md:block" />
            擦肩而过 17 次
          </h1>
          <p className="text-base md:text-xl text-on-surface-variant max-w-3xl mx-auto leading-relaxed font-medium px-4 animate-fade-in-up animation-delay-200">
            在数据噪声中，算法为你观测到了那一颗唯一共鸣的星。<br className="hidden md:block" />
            这不是偶然，是被计算出的重逢。
          </p>
          {/* Dynamic Status Indicators */}
          <div className="mt-10 md:mt-12 flex flex-col items-center gap-4 text-orange-700/60 font-medium text-xs md:text-sm animate-fade-in-up animation-delay-300">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="tracking-wide">正在检索附近的灵魂信号<span className="inline-flex w-[18px]"><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span></span>
            </div>
            <div className="flex items-center gap-3 opacity-60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-500"></span>
              </span>
              <span className="tracking-wide">排除随机干扰，深度特征对齐中<span className="inline-flex w-[18px]"><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span></span>
            </div>
            <p className="text-[10px] md:text-xs text-stone-400 italic mt-2">"在这座校园里，有些相遇本该发生。"</p>
          </div>
        </section>

        {/* Transition Section */}
        <section className="max-w-5xl mx-auto px-6 mb-12 md:mb-16 text-center">
          <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent via-orange-200 to-transparent mx-auto mb-10 md:mb-12 animate-fade-in-up animation-delay-200" />
          <h2 className="text-2xl md:text-3xl font-bold text-on-surface mb-4 animate-fade-in-up animation-delay-300">在同一个时空，刚好同频。</h2>
          <p className="text-sm md:text-base text-on-surface-variant max-w-2xl mx-auto leading-relaxed px-4 animate-fade-in-up animation-delay-400">
            也许在 11 号楼，或是图书馆，你们曾共享过同一束光。现在，算法让你们正式相识。
          </p>
        </section>

        {/* Bento Grid Section */}
        <section className="max-w-7xl mx-auto px-6 space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Card: 时间的信差 */}
            <div className="glass-panel p-6 md:p-10 rounded-3xl flex flex-col gap-6 group hover:bg-white/60 transition-all duration-500 shadow-lg shadow-orange-900/[0.03] animate-fade-in-up animation-delay-300 hover:-translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-2xl md:text-3xl">inventory_2</span>
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-on-surface mb-2 md:mb-3">时间的信差</h3>
                <p className="text-sm md:text-base text-on-surface-variant leading-relaxed">
                  告别速食。每周三 12:00，一份跨越数字荒原的信件，只为值得等待的人开启。
                </p>
              </div>
              <div className="mt-auto pt-2 overflow-hidden rounded-xl h-32 md:h-40">
                <img
                  alt="minimalist envelope"
                  className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                  src="/envelope.jpg"
                />
              </div>
            </div>

            {/* Card: 同频的避风港 */}
            <div className="glass-panel p-6 md:p-10 rounded-3xl flex flex-col gap-6 group hover:bg-white/60 transition-all duration-500 shadow-lg shadow-orange-900/[0.03] animate-fade-in-up animation-delay-400 hover:-translate-y-2">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-2xl md:text-3xl">verified_user</span>
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-on-surface mb-2 md:mb-3">同频的避风港</h3>
                <p className="text-sm md:text-base text-on-surface-variant leading-relaxed">
                  仅限 HEU 实名在校生。在这个半封闭的实验场里，只有最纯粹的学子情谊与工程大脑的碰撞。
                </p>
              </div>
              <div className="mt-auto pt-4 flex -space-x-3 md:-space-x-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-[3px] md:border-4 border-surface overflow-hidden shadow-sm">
                  <img alt="student 1" className="w-full h-full object-cover" src="/student1.svg" />
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-[3px] md:border-4 border-surface overflow-hidden shadow-sm">
                  <img alt="student 2" className="w-full h-full object-cover" src="/student2.svg" />
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-[3px] md:border-4 border-surface flex items-center justify-center bg-orange-500 text-white font-bold text-[10px] md:text-xs shadow-sm">
                  +12k
                </div>
              </div>
            </div>
          </div>

          {/* Card: 灵魂的刻度 */}
          <div className="glass-panel p-6 md:p-10 rounded-3xl flex flex-col md:flex-row gap-6 md:gap-8 items-center relative overflow-hidden group shadow-lg shadow-orange-900/[0.03] animate-fade-in-up animation-delay-500">
            <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-orange-400/10 blur-[80px] md:blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10" />
            <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-200 flex items-center justify-center text-orange-800">
              <span className="material-symbols-outlined text-2xl md:text-3xl">analytics</span>
            </div>
            <div className="flex-grow text-center md:text-left">
              <h3 className="text-xl md:text-2xl font-bold text-on-surface mb-2">灵魂的刻度</h3>
              <p className="text-sm md:text-base text-on-surface-variant leading-relaxed">
                32 个维度的心理建模，12 项价值观深度对齐。我们用最理性的逻辑，证明最感性的默契。
              </p>
            </div>
            <div className="w-full md:w-96 bg-white/60 backdrop-blur-md rounded-2xl p-5 md:p-8 outline outline-1 outline-orange-200/30 shadow-sm">
              <div className="flex items-end justify-between mb-4 md:mb-6">
                <span className="text-[10px] md:text-xs font-bold text-orange-800/60 tracking-wider uppercase">
                  Match Factor契合指数
                </span>
                <span className="text-3xl md:text-4xl font-black text-orange-700 leading-none">98.2%</span>
              </div>
              <div className="space-y-3 md:space-y-4">
                <div className="h-2 w-full bg-stone-200/50 rounded-full overflow-hidden">
                  <div className="h-full orange-glow w-[98.2%] rounded-full transition-all duration-1000 ease-out" />
                </div>
                <div className="flex justify-between text-[9px] md:text-[11px] font-bold text-orange-700/40">
                  <span>NEURAL SYNC</span>
                  <span>PEAK ALIGNMENT</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Decoration Elements */}
        <div className="absolute top-[20%] -left-32 md:-left-64 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-orange-200/20 blur-[80px] md:blur-[120px] rounded-full -z-10 animate-float-slow" />
        <div className="absolute top-[60%] -right-32 md:-right-64 w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-primary/10 blur-[70px] md:blur-[100px] rounded-full -z-10 animate-float-slower" />
      </main>

      {/* Footer Area */}
      <div className="relative py-12 flex flex-col items-center">
        <p className="text-on-surface-variant font-medium text-sm md:text-lg italic text-center px-10 mb-8 max-w-lg">
          "算法是冷的，但它是为了寻找热的灵魂。"
        </p>
        {/* CTA Button */}
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm flex justify-center pointer-events-none">
          <Link
            to={isLoggedIn ? '/questionnaire/1' : '/login'}
            className="pointer-events-auto orange-glow text-white w-full py-5 rounded-full flex items-center justify-center gap-3 font-extrabold text-lg md:text-xl deep-glow-shadow transition-all duration-300 hover:scale-105 active:scale-95 group hover:-translate-y-1"
          >
            <span className="material-symbols-outlined text-2xl md:text-3xl group-hover:scale-110 transition-transform" style={{ fontVariationSettings: '"FILL" 1' }}>
              favorite
            </span>
            <span>开启我的灵魂盲盒</span>
          </Link>
        </div>
        <footer className="mt-8 text-center pb-72 md:pb-64">
          <Link
            to="/feedback"
            className="inline-block text-orange-600 hover:text-orange-700 font-medium text-xs md:text-sm mb-4 transition-colors"
          >
            联系我们
          </Link>
          <p className="text-on-surface-variant/40 text-[10px] md:text-sm">© 2024 🍊意配 | HEU 校园专属社交实验</p>
        </footer>
      </div>
    </>
  );
};

export default HomePage;