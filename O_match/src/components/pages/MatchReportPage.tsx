import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMatchStore } from '@/store';

const RADAR_DIMENSION_LABELS = ['价值观', '生活习惯', '性格互补', '兴趣重叠', '期望匹配'];

const MatchReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { matchReport, reportLoading, fetchMatchReport } = useMatchStore();

  useEffect(() => {
    fetchMatchReport();
  }, [fetchMatchReport]);

  // 加载中
  if (reportLoading) {
    return (
      <main className="max-w-4xl mx-auto px-6 mt-12 space-y-12 py-16 text-center">
        <div className="text-on-surface-variant animate-pulse">正在生成匹配报告...</div>
      </main>
    );
  }

  // 无报告
  if (!matchReport) {
    return (
      <main className="max-w-4xl mx-auto px-6 mt-12 space-y-12 py-16 text-center">
        <div className="glass-card rounded-[2rem] p-12 space-y-4">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/40">description</span>
          <h2 className="text-2xl font-bold text-on-surface">暂无匹配报告</h2>
          <p className="text-on-surface-variant">你还没有完成匹配，或者匹配报告尚未生成。</p>
          <button
            onClick={() => navigate('/waiting')}
            className="mt-4 px-8 py-3 bg-primary text-white rounded-full font-bold"
          >
            返回等待页
          </button>
        </div>
      </main>
    );
  }

  const compatibility = matchReport.compatibilityScore;
  const rankPercent = matchReport.rankPercent;
  const iceTask = matchReport.iceBreakingTask;
  const timeRemaining = matchReport.timeRemaining;
  const resonances = matchReport.resonancePoints;

  // 五维度分数（0-100）
  const dimScores = matchReport.dimensions.map((d) => d.score);

  // 计算五边形雷达图顶点坐标
  const getRadarPoints = () => {
    const center = 50;
    const maxRadius = 40;
    const angles = [
      -Math.PI / 2,                    // 顶部：价值观
      -Math.PI / 2 + (2 * Math.PI) / 5, // 右上方：生活习惯
      -Math.PI / 2 + (4 * Math.PI) / 5, // 右下方：性格互补
      -Math.PI / 2 - (4 * Math.PI) / 5, // 左下方：兴趣重叠
      -Math.PI / 2 - (2 * Math.PI) / 5, // 左上方：期望匹配
    ];

    return dimScores
      .map((score, i) => {
        const r = maxRadius * (score / 100);
        const x = center + r * Math.cos(angles[i]);
        const y = center + r * Math.sin(angles[i]);
        return `${x},${y}`;
      })
      .join(' ');
  };

  // 标签位置
  const getLabelPositions = () => {
    const center = 50;
    const labelRadius = 52;
    const angles = [
      -Math.PI / 2,
      -Math.PI / 2 + (2 * Math.PI) / 5,
      -Math.PI / 2 + (4 * Math.PI) / 5,
      -Math.PI / 2 - (4 * Math.PI) / 5,
      -Math.PI / 2 - (2 * Math.PI) / 5,
    ];
    return angles.map((angle) => ({
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    }));
  };

  const labels = getLabelPositions();

  return (
    <main className="max-w-4xl mx-auto px-6 mt-12 space-y-12 pb-32">
      {/* Hero Section: 契合度 */}
      <section className="relative text-center py-16 px-8 rounded-[2rem] overflow-hidden bg-surface-container-low">
        <div className="absolute inset-0 opacity-10 pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <span className="label-md text-primary font-semibold tracking-widest uppercase">Matching Report</span>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-on-surface">
            契合度{' '}
            <span className="bg-gradient-to-tr from-primary to-primary-container bg-clip-text text-transparent">
              {compatibility}%
            </span>
          </h1>
          {/* Normal Distribution Visualization */}
          <div className="w-full max-w-md mx-auto pt-8">
            <div className="relative h-24 w-full">
              <svg className="w-full h-full text-surface-container-highest stroke-outline-variant fill-none" viewBox="0 0 400 100">
                <path d="M0,100 Q100,100 200,10 T300,100 T400,100" strokeWidth="2"></path>
                {/* 标记位置基于 rankPercent */}
                <circle cx={100 + (rankPercent / 100) * 200} cy={10 + (1 - rankPercent / 100) * 60} r="6"></circle>
                <text className="text-[10px] font-bold fill-primary" x={110 + (rankPercent / 100) * 200} y={10 + (1 - rankPercent / 100) * 60 - 5}>YOU</text>
              </svg>
              <div className="mt-2 text-label-md text-on-surface-variant italic">
                恭喜！你们的契合度击败了全校 {rankPercent}% 的校友组合
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Soul Radar & Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Radar Card */}
        <div className="md:col-span-7 glass-card bento-asymmetric p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">灵魂雷达图</h3>
            <p className="text-on-surface-variant text-sm mb-8">基于五维问卷的深度契合度分析</p>
          </div>
          <div className="relative aspect-square w-full max-w-[300px] mx-auto flex items-center justify-center">
            {/* Radar Mesh Background */}
            <div className="absolute inset-0 radar-grid bg-surface-container-high opacity-30" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
            <div className="absolute inset-4 radar-grid bg-surface-container-high opacity-50" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
            <div className="absolute inset-8 radar-grid bg-surface-container-high opacity-70" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
            {/* Radar Polygon Fill */}
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100">
              <polygon className="fill-primary/20 stroke-primary stroke-[1.5]" points={getRadarPoints()}></polygon>
              {RADAR_DIMENSION_LABELS.map((label, i) => (
                <text
                  key={label}
                  className={`text-[6px] font-bold fill-on-surface ${i === 0 ? '[text-anchor:middle]' : i < 3 ? '[text-anchor:start]' : '[text-anchor:end]'}`}
                  x={labels[i].x}
                  y={labels[i].y}
                  textAnchor={i === 0 ? 'middle' : i < 3 ? 'start' : 'end'}
                >
                  {label}
                </text>
              ))}
              {/* 分数标注 */}
              {dimScores.map((score, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                const scoreR = 40 * (score / 100) + 6;
                const sx = 50 + scoreR * Math.cos(angle);
                const sy = 50 + scoreR * Math.sin(angle);
                return (
                  <text key={`s${i}`} className="text-[5px] fill-primary font-bold" textAnchor="middle" x={sx} y={sy}>
                    {Math.round(score)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Ice Breaking Card + Countdown */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="flex-1 glass-card rounded-3xl p-6 shadow-sm flex flex-col justify-between border border-white/20">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-xl">celebration</span>
                <h4 className="text-xl font-bold tracking-tight">破冰任务</h4>
              </div>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6">{iceTask.description}</p>
            </div>
            <div className="mt-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase">
                <span className="w-1 h-1 rounded-full bg-primary"></span>
                {iceTask.location || 'Soul Connection'}
              </div>
            </div>
          </div>
          <div className="bg-secondary-fixed text-on-secondary-fixed p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined">schedule</span>
              <span className="text-sm font-bold">匹配时效</span>
            </div>
            <div className="text-4xl font-black tracking-tighter">{timeRemaining}</div>
            <p className="text-xs mt-2 opacity-80">缘分转瞬即逝，请在 3 天内开启首聊</p>
          </div>
        </div>
      </div>

      {/* Resonance Points */}
      <section className="space-y-6">
        <h3 className="text-3xl font-bold tracking-tight px-2">共鸣时刻</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resonances.map((item, index) => (
            <div key={index} className="p-8 rounded-[2rem] bg-surface-container-low space-y-4 hover:shadow-xl transition-shadow">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  item.color === 'primary'
                    ? 'bg-primary-fixed'
                    : item.color === 'secondary'
                      ? 'bg-secondary-fixed'
                      : 'bg-tertiary-fixed'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    item.color === 'primary'
                      ? 'text-primary'
                      : item.color === 'secondary'
                        ? 'text-secondary'
                        : 'text-tertiary'
                  }`}
                >
                  {item.icon}
                </span>
              </div>
              <h5 className="text-lg font-bold">{item.title}</h5>
              <p className="text-on-surface-variant text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="flex flex-col items-center py-12 gap-4">
        <button
          onClick={() => navigate('/chat')}
          className="w-full max-w-md py-5 bg-gradient-to-tr from-primary to-primary-container text-white text-lg font-bold rounded-full shadow-[0_8px_32px_rgba(148,74,0,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
        >
          开启 72 小时限时聊天
        </button>
      </section>

      {/* Fallback/Next State */}
      <section className="mt-16 py-8 border-t border-outline-variant/20">
        <Link to="/waiting" className="block">
          <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">hourglass_empty</span>
              </div>
              <div>
                <p className="text-sm font-bold">想要更多可能？</p>
                <p className="text-xs text-on-surface-variant">下周三 12:00 准时开启</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </div>
        </Link>
      </section>
    </main>
  );
};

export default MatchReportPage;
