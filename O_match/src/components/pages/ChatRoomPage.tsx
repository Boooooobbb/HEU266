import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCountdown } from '@/hooks';
import { useMatchStore } from '@/store';
import type { ChatContext, IceReplyResult, RoundStatus } from '@/services/chatService';
import {
  blockUser,
  confirmConnection,
  getBlockStatus,
  getPartnerContactInfo,
  getRoundStatus,
  reportUser,
  resolveChatContext,
  setActiveLocalChatMatchId,
  submitIceReply,
  unblockUser,
} from '@/services/chatService';
import type { ContactMethod } from '@/services/contactMethodsService';
import { cancelMatching } from '@/services/matchingService';
import type { MatchReportData, ResonancePoint } from '@/types';

// ============================================================
// 结构化破冰房间 — 替代自由匿名聊天
// Round 1: 共鸣时刻 → Round 2: 破冰任务 → Round 3: 心电感应
// ============================================================

const stageLabelMap: Record<string, string> = {
  undergrad_low: '本科低年级',
  undergrad_high: '本科高年级',
  master: '硕士阶段',
  doctor: '博士阶段',
};

const platformLabelMap: Record<string, string> = {
  wechat: '微信',
  qq: 'QQ',
  douyin: '抖音',
};

const platformColorMap: Record<string, string> = {
  wechat: 'bg-[#07C160]',
  qq: 'bg-[#2A8CFF]',
  douyin: 'bg-[#121212]',
};

const ROUND_LABELS = ['共鸣时刻', '破冰任务', '心电感应'];
const ROUND_ICONS = ['🎵', '🧩', '💌'];
const ROUND_PROMPTS = [
  '看到这个共鸣点，说说你的想法...',
  '面对这个破冰任务，你有什么想说的...',
  '',
];

interface ChatRouteState {
  chatContext?: ChatContext;
  matchReport?: MatchReportData;
  contactMethods?: ContactMethod[];
}

const ChatRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as ChatRouteState | null) ?? null;

  // ---- 核心状态 ----
  const [chatContext, setChatContext] = useState<ChatContext | null>(routeState?.chatContext ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  // 冰破状态
  const [roundStatus, setRoundStatus] = useState<RoundStatus>({
    currentRound: 1,
    myReplies: {},
    partnerReplies: {},
    partnerConfirmed: false,
    iConfirmed: false,
  });
  // 缓存自己已提交的回复内容，用于 UI 展示（roundStatus.myReplies 只存 ID）
  const [myReplyContents, setMyReplyContents] = useState<Record<number, string>>({});
  const [myInput, setMyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [partnerContact, setPartnerContact] = useState<ContactMethod[]>([]);

  // 匹配报告数据
  const [resonancePoints, setResonancePoints] = useState<ResonancePoint[]>([]);
  const [iceBreakingTask, setIceBreakingTask] = useState<MatchReportData['iceBreakingTask'] | null>(null);

  // 安全状态
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const countdown = useCountdown({ initialSeconds: 72 * 3600 });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ---- 初始化 ----
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);
        setError('');

        // 解析聊天上下文
        const context = routeState?.chatContext ?? (await resolveChatContext());
        if (!mounted) return;
        setChatContext(context);

        // 加载匹配报告数据
        const report = routeState?.matchReport;
        if (report) {
          setResonancePoints(report.resonancePoints || []);
          setIceBreakingTask(report.iceBreakingTask || null);
        }

        // 加载冰破轮次状态
        const status = await getRoundStatus(context.matchId);
        if (!mounted) return;
        setRoundStatus(status);

        if (status.iConfirmed && status.partnerConfirmed) {
          setConnected(true);
          // 页面刷新时已双向确认：加载对方联系方式
          if (context.partnerId) {
            getPartnerContactInfo(context.partnerId).then((contact) => {
              if (contact.length > 0) setPartnerContact(contact);
            });
          }
        }

        // 检查拉黑状态
        setActiveLocalChatMatchId(context.matchId);
        const blockState = await getBlockStatus(context.matchId, context.partnerId ?? null);
        if (!mounted) return;
        setIsBlocked(blockState.isBlocked);

        setLoading(false);
      } catch {
        if (!mounted) return;
        setError('加载失败，请稍后重试');
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      setActiveLocalChatMatchId(null);
    };
  }, [routeState?.chatContext, routeState?.matchReport, routeState?.contactMethods]);

  // 如果匹配报告未预加载，尝试从 store 获取
  useEffect(() => {
    if (resonancePoints.length > 0 || !chatContext) return;

    const { matchReport } = useMatchStore.getState();
    if (matchReport) {
      setResonancePoints(matchReport.resonancePoints || []);
      setIceBreakingTask(matchReport.iceBreakingTask || null);
    }
  }, [chatContext, resonancePoints.length]);

  // 监听双向确认 → 触发庆祝
  useEffect(() => {
    if (roundStatus.iConfirmed && roundStatus.partnerConfirmed && !connected) {
      loadPartnerContactAndCelebrate();
    }
  }, [roundStatus.iConfirmed, roundStatus.partnerConfirmed, connected, chatContext?.partnerId]);

  // 生产环境轮询：等待对方回复时每 10s 刷新状态
  useEffect(() => {
    if (!chatContext || chatContext.isDemo) return;

    const currentRound = roundStatus.currentRound;
    // Round 3 不需要轮询回复（用确认机制），只在 Round 1/2 等待对方回复时轮询
    if (currentRound >= 3) return;

    const iHaveReplied = Boolean(roundStatus.myReplies[currentRound]);
    const partnerHasReplied = Boolean(roundStatus.partnerReplies[currentRound]);
    // 只有我已回复但对方未回复时才需要轮询
    if (!iHaveReplied || partnerHasReplied) return;

    const POLL_INTERVAL = 10_000;
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      try {
        const status = await getRoundStatus(chatContext.matchId);
        if (!mounted) return;
        setRoundStatus(status);
      } catch {
        // 轮询静默失败
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL);
    // 立即执行一次
    poll();

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [chatContext, roundStatus.currentRound, roundStatus.myReplies, roundStatus.partnerReplies]);

  // 监听 demo 模式下对方的回复事件
  useEffect(() => {
    const handlePartnerReply = (event: Event) => {
      const detail = (event as CustomEvent<{ matchId: string; round: number; reply: IceReplyResult }>).detail;
      if (!detail || detail.matchId !== chatContext?.matchId) return;

      setRoundStatus((prev) => ({
        ...prev,
        partnerReplies: { ...prev.partnerReplies, [detail.round]: detail.reply },
      }));
    };

    const handlePartnerConfirm = (event: Event) => {
      const detail = (event as CustomEvent<{ matchId: string }>).detail;
      if (!detail || detail.matchId !== chatContext?.matchId) return;

      setRoundStatus((prev) => ({ ...prev, partnerConfirmed: true }));
    };

    window.addEventListener('ice-partner-reply', handlePartnerReply);
    window.addEventListener('ice-partner-confirmed', handlePartnerConfirm);

    return () => {
      window.removeEventListener('ice-partner-reply', handlePartnerReply);
      window.removeEventListener('ice-partner-confirmed', handlePartnerConfirm);
    };
  }, [chatContext?.matchId]);

  // 自动滚动
  useEffect(() => {
    if (loading || !messagesEndRef.current) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
    });
  }, [loading, roundStatus]);

  // ---- 业务逻辑 ----

  const handleSubmitReply = async () => {
    if (!myInput.trim() || !chatContext) return;

    const round = roundStatus.currentRound;
    const content = myInput.trim();

    setSubmitting(true);
    setError('');

    const result = await submitIceReply(chatContext.matchId, round, content);

    setSubmitting(false);

    if (!result.success || !result.reply) {
      setError(result.error || '提交失败');
      return;
    }

    setMyInput('');
    // 缓存回复内容用于展示
    setMyReplyContents((prev) => ({ ...prev, [round]: content }));
    setRoundStatus((prev) => ({
      ...prev,
      myReplies: { ...prev.myReplies, [round]: result.reply!.id },
    }));
  };

  const handleGoToNextRound = async () => {
    if (!chatContext) return;
    setError('');
    try {
      const status = await getRoundStatus(chatContext.matchId);
      setRoundStatus(status);
    } catch {
      setError('刷新状态失败，请稍后重试');
    }
  };

  const handleConfirmConnection = async () => {
    if (!chatContext) return;

    setSubmitting(true);
    setError('');

    const result = await confirmConnection(chatContext.matchId, chatContext.partnerId);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || '操作失败');
      return;
    }

    setRoundStatus((prev) => ({
      ...prev,
      iConfirmed: true,
      partnerConfirmed: result.partnerConfirmed,
    }));

    if (result.bothConfirmed) {
      setConnected(true);
      if (result.partnerContact && result.partnerContact.length > 0) {
        setPartnerContact(result.partnerContact);
      } else {
        // 尝试主动获取
        loadPartnerContactAndCelebrate();
      }
    } else {
      setHint('已确认！等待对方确认后即可交换联系方式。');
    }
  };

  const loadPartnerContactAndCelebrate = async () => {
    if (!chatContext?.partnerId) return;
    const contact = await getPartnerContactInfo(chatContext.partnerId);
    if (contact.length > 0) {
      setPartnerContact(contact);
    }
    setConnected(true);
  };

  const handleReportPartner = async () => {
    if (!chatContext) return;
    const reason = window.prompt('请输入举报原因（必填）');
    if (!reason) return;
    const details = window.prompt('补充说明（可选）') || '';
    const result = await reportUser(chatContext.matchId, chatContext.partnerId, { reason, details });
    if (!result.success) {
      setError(result.error || '举报失败');
      return;
    }
    setHint('举报已提交，我们会尽快处理。');
  };

  const handleBlockPartner = async () => {
    if (!chatContext) return;
    const confirmed = window.confirm('确认要拉黑该用户吗？拉黑后将无法继续互发消息。');
    if (!confirmed) return;
    const reason = window.prompt('可填写拉黑原因（可选）') || '';
    setBlocking(true);
    const result = await blockUser(chatContext.matchId, chatContext.partnerId, reason);
    setBlocking(false);
    if (!result.success) {
      setError(result.error || '拉黑失败');
      return;
    }
    setIsBlocked(true);
    setHint('已拉黑该用户。');
  };

  const handleUnblockPartner = async () => {
    if (!chatContext) return;
    const confirmed = window.confirm('确认要取消拉黑吗？');
    if (!confirmed) return;
    setBlocking(true);
    const result = await unblockUser(chatContext.matchId, chatContext.partnerId);
    setBlocking(false);
    if (!result.success) {
      setError(result.error || '取消拉黑失败');
      return;
    }
    setIsBlocked(false);
    setHint('已取消拉黑该用户。');
  };

  const handleEndMatch = async () => {
    if (!chatContext) return;
    const confirmed = window.confirm('确认结束这段匹配吗？');
    if (!confirmed) return;
    setError('');
    setHint('');
    try {
      await cancelMatching();
      setHint('已结束匹配，正在返回等待页。');
      navigate('/waiting', { replace: true });
    } catch {
      setError('结束匹配失败，请稍后重试');
    }
  };

  // ---- 渲染辅助 ----

  const partnerDisplayName = chatContext?.partnerNickname?.trim() || '橘子同学';
  const partnerStageText = chatContext?.partnerStage
    ? (stageLabelMap[chatContext.partnerStage] || chatContext.partnerStage)
    : '阶段未公开';
  const partnerMatchRateText =
    typeof chatContext?.matchRate === 'number'
      ? `${Math.round(chatContext.matchRate)}% 灵魂契合`
      : '灵魂契合待生成';

  const hasMyReply = (round: number) => Boolean(roundStatus.myReplies[round]);
  const hasPartnerReply = (round: number) => Boolean(roundStatus.partnerReplies[round]);

  const currentResonance = resonancePoints[0] || null;
  const currentIceTask = iceBreakingTask;

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="relative z-10 pt-32 md:pt-44 pb-24">
      {/* ---- 固定顶栏 ---- */}
      <div className="fixed top-28 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-7xl">
        <div className="rounded-[999px] px-5 py-4 flex flex-col items-start md:flex-row md:flex-wrap md:items-center md:justify-between gap-4 shadow-[0_16px_40px_-16px_rgba(148,74,0,0.55)] border border-orange-300/70 bg-gradient-to-br from-orange-200/88 via-orange-100/88 to-orange-50/88 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-2xl shadow border-2 border-white">
              🍊
            </div>
            <div>
              <div className="font-bold text-on-surface">{partnerDisplayName}</div>
              <div className="text-xs text-on-surface-variant">
                {partnerMatchRateText} · {partnerStageText}
              </div>
            </div>
          </div>
          <div className="w-full md:w-auto flex items-center gap-3 md:gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50/95 border border-orange-300/60 rounded-full">
              <span className="material-symbols-outlined text-orange-700 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              <span className="text-xs font-bold text-orange-800">{countdown.formatted}</span>
            </div>
            <button onClick={handleEndMatch} className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-red-500 hover:bg-red-600 transition-colors shadow-sm">
              结束匹配
            </button>
            <button onClick={handleReportPartner} className="px-4 py-1.5 text-xs font-bold text-[#A64B00] rounded-full border border-[#F2C28F] bg-[#FFE8CC] hover:bg-[#FFD9B0] transition-colors shadow-sm">
              举报
            </button>
            {isBlocked ? (
              <button onClick={handleUnblockPartner} disabled={blocking} className="px-4 py-1.5 text-xs font-bold text-orange-900 rounded-full border border-orange-300/80 bg-orange-100/90 hover:bg-orange-50 transition-colors shadow-sm disabled:opacity-40">
                {blocking ? '处理中...' : '取消拉黑'}
              </button>
            ) : (
              <button onClick={handleBlockPartner} disabled={blocking} className="px-4 py-1.5 text-xs font-bold text-white rounded-full border border-orange-500/70 bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-40">
                {blocking ? '处理中...' : '拉黑'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---- 主内容区 ---- */}
      <div className="mx-auto w-[92%] max-w-2xl space-y-8 pb-32">
        {loading && (
          <div className="text-center py-16">
            <div className="text-on-surface-variant animate-pulse">加载破冰之旅...</div>
          </div>
        )}

        {!loading && isBlocked && (
          <div className="glass-card rounded-[2rem] p-12 text-center space-y-4">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/40">block</span>
            <h2 className="text-xl font-bold text-on-surface">已拉黑该用户</h2>
            <p className="text-on-surface-variant text-sm">你可以取消拉黑以继续破冰流程。</p>
          </div>
        )}

        {!loading && !isBlocked && connected && (
          /* ---- 连接已建立（庆祝状态）---- */
          <div className="space-y-8">
            <div className="text-center py-8">
              <div className="text-8xl mb-6 animate-bounce">🎉</div>
              <h2 className="text-3xl font-black text-on-surface mb-2">连接已建立！</h2>
              <p className="text-on-surface-variant">
                你们已经通过了三轮破冰，以下是 {partnerDisplayName} 的联系方式：
              </p>
            </div>

            {partnerContact.length > 0 ? (
              <div className="space-y-3">
                {partnerContact.map((c) => (
                  <div key={c.platform} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${platformColorMap[c.platform] || 'bg-primary'} flex items-center justify-center text-white text-lg font-bold`}>
                      {platformLabelMap[c.platform]?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-on-surface-variant">{platformLabelMap[c.platform] || c.platform}</div>
                      <div className="text-lg font-bold text-on-surface truncate">{c.value}</div>
                    </div>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(c.value); setHint(`已复制${platformLabelMap[c.platform]}`); }}
                      className="px-4 py-2 text-xs font-bold text-primary rounded-full border border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      复制
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-on-surface-variant text-sm">
                对方暂未设置联系方式。请等待对方补充。
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-xs text-on-surface-variant/50">
                🍊 感谢你完成破冰之旅，快去建立真正的连接吧！
              </p>
            </div>
          </div>
        )}

        {!loading && !isBlocked && !connected && (
          <>
            {/* ---- 轮次进度指示器 ---- */}
            <div className="flex items-center justify-center gap-3 py-4">
              {[1, 2, 3].map((round) => {
                const isActive = round === roundStatus.currentRound;
                const isDone = round < roundStatus.currentRound || (round === roundStatus.currentRound && hasMyReply(round) && hasPartnerReply(round));
                return (
                  <React.Fragment key={round}>
                    {round > 1 && (
                      <div className={`w-8 h-0.5 rounded-full transition-colors ${isDone ? 'bg-primary' : 'bg-outline-variant/30'}`} />
                    )}
                    <div
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all
                        ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' : ''}
                        ${isDone && !isActive ? 'bg-primary/10 text-primary' : ''}
                        ${!isActive && !isDone ? 'bg-surface-container-low text-on-surface-variant/50' : ''}
                      `}
                    >
                      <span>{ROUND_ICONS[round - 1]}</span>
                      <span className="hidden sm:inline">{ROUND_LABELS[round - 1]}</span>
                      {hasMyReply(round) && hasPartnerReply(round) && (
                        <span className="material-symbols-outlined text-sm text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* ---- Round 1: 共鸣时刻 ---- */}
            {roundStatus.currentRound === 1 && (
              <div className="space-y-6">
                {currentResonance ? (
                  <div className={`glass-card rounded-[2rem] p-8 space-y-4 border ${
                    currentResonance.color === 'primary' ? 'border-primary/20' :
                    currentResonance.color === 'secondary' ? 'border-secondary/20' : 'border-tertiary/20'
                  }`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                      currentResonance.color === 'primary' ? 'bg-primary-fixed' :
                      currentResonance.color === 'secondary' ? 'bg-secondary-fixed' : 'bg-tertiary-fixed'
                    }`}>
                      <span className="material-symbols-outlined">{currentResonance.icon}</span>
                    </div>
                    <h3 className="text-2xl font-black text-on-surface">{currentResonance.title}</h3>
                    <p className="text-on-surface-variant leading-relaxed">{currentResonance.description}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      你们的共鸣时刻
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-[2rem] p-8 text-center space-y-4">
                    <div className="text-5xl">🎵</div>
                    <h3 className="text-2xl font-black text-on-surface">共鸣时刻</h3>
                    <p className="text-on-surface-variant">
                      匹配报告显示你们有多处灵魂共鸣。分享一下你对这些共同点的想法吧。
                    </p>
                  </div>
                )}

                {/* 回复区 */}
                {!hasMyReply(1) && (
                  <div className="glass-card rounded-[2rem] p-6 space-y-4">
                    <p className="text-sm font-bold text-on-surface">
                      分享一下你对这个共鸣时刻的想法...
                    </p>
                    <textarea
                      className="w-full bg-white/60 border border-white/60 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none placeholder:text-on-surface-variant/30"
                      rows={3}
                      placeholder={ROUND_PROMPTS[0]}
                      value={myInput}
                      onChange={(e) => setMyInput(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitReply}
                        disabled={submitting || !myInput.trim()}
                        className="px-8 py-3 bg-primary text-white rounded-full font-bold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-40"
                      >
                        {submitting ? '发送中...' : '提交回复'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 已回复显示 */}
                {hasMyReply(1) && (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-lg">👤</div>
                      <div className="bg-primary text-white px-5 py-3 rounded-2xl rounded-br-none max-w-[80%]">
                        <p className="text-sm">{myReplyContents[1] || '（已回复）'}</p>
                      </div>
                    </div>

                    {hasPartnerReply(1) && roundStatus.partnerReplies[1] ? (
                      <>
                        <div className="flex items-end gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-lg">🍊</div>
                          <div className="glass-card px-5 py-3 rounded-2xl rounded-bl-none max-w-[80%]">
                            <p className="text-sm text-on-surface">{roundStatus.partnerReplies[1].content}</p>
                          </div>
                        </div>
                        <div className="text-center pt-4">
                          <button
                            onClick={handleGoToNextRound}
                            className="px-10 py-3 bg-primary text-white rounded-full font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2 mx-auto"
                          >
                            进入下一轮
                            <span className="material-symbols-outlined">arrow_forward</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-sm">
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                          等待对方回复...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ---- Round 2: 破冰任务 ---- */}
            {roundStatus.currentRound === 2 && (
              <div className="space-y-6">
                {currentIceTask ? (
                  <div className="glass-card rounded-[2rem] p-8 space-y-4 border border-secondary/20 bg-gradient-to-br from-secondary-fixed/30 to-white">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-secondary text-2xl">celebration</span>
                      <h3 className="text-2xl font-black text-on-surface">{currentIceTask.title}</h3>
                    </div>
                    <p className="text-on-surface-variant leading-relaxed">{currentIceTask.description}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold tracking-wider uppercase">
                      <span className="w-1 h-1 rounded-full bg-secondary" />
                      {currentIceTask.location || 'Soul Connection'}
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-[2rem] p-8 text-center space-y-4">
                    <div className="text-5xl">🧩</div>
                    <h3 className="text-2xl font-black text-on-surface">破冰任务</h3>
                    <p className="text-on-surface-variant">
                      一起完成这个特别的任务，让你们的连接更进一步。
                    </p>
                  </div>
                )}

                {!hasMyReply(2) && (
                  <div className="glass-card rounded-[2rem] p-6 space-y-4">
                    <p className="text-sm font-bold text-on-surface">
                      完成这个破冰任务，说说你的想法...
                    </p>
                    <textarea
                      className="w-full bg-white/60 border border-white/60 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none placeholder:text-on-surface-variant/30"
                      rows={3}
                      placeholder={ROUND_PROMPTS[1]}
                      value={myInput}
                      onChange={(e) => setMyInput(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitReply}
                        disabled={submitting || !myInput.trim()}
                        className="px-8 py-3 bg-primary text-white rounded-full font-bold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-40"
                      >
                        {submitting ? '发送中...' : '提交回复'}
                      </button>
                    </div>
                  </div>
                )}

                {hasMyReply(2) && (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-lg">👤</div>
                      <div className="bg-primary text-white px-5 py-3 rounded-2xl rounded-br-none max-w-[80%]">
                        <p className="text-sm">{myReplyContents[2] || '（已回复）'}</p>
                      </div>
                    </div>

                    {hasPartnerReply(2) && roundStatus.partnerReplies[2] ? (
                      <>
                        <div className="flex items-end gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-lg">🍊</div>
                          <div className="glass-card px-5 py-3 rounded-2xl rounded-bl-none max-w-[80%]">
                            <p className="text-sm text-on-surface">{roundStatus.partnerReplies[2].content}</p>
                          </div>
                        </div>
                        <div className="text-center pt-4">
                          <button
                            onClick={handleGoToNextRound}
                            className="px-10 py-3 bg-primary text-white rounded-full font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2 mx-auto"
                          >
                            进入最后一轮
                            <span className="material-symbols-outlined">arrow_forward</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-sm">
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                          等待对方回复...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ---- Round 3: 心电感应 ---- */}
            {roundStatus.currentRound === 3 && !roundStatus.iConfirmed && (
              <div className="space-y-6">
                <div className="glass-card rounded-[2rem] p-10 text-center space-y-6 border border-pink-200/50 bg-gradient-to-br from-pink-50/80 to-white">
                  <div className="text-7xl animate-pulse">💌</div>
                  <h3 className="text-3xl font-black text-on-surface">心电感应</h3>
                  <p className="text-on-surface-variant leading-relaxed max-w-md mx-auto">
                    你们已经完成了两轮破冰，彼此有了初步的了解。
                    <br />
                    现在，是否愿意交换联系方式，建立真正的连接？
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <button
                      onClick={handleConfirmConnection}
                      disabled={submitting}
                      className="px-10 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-40 text-lg"
                    >
                      {submitting ? '处理中...' : '愿意交换联系方式 💌'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Round 3: 我已确认，等待对方 */}
            {roundStatus.currentRound === 3 && roundStatus.iConfirmed && !roundStatus.partnerConfirmed && !connected && (
              <div className="space-y-6">
                <div className="glass-card rounded-[2rem] p-10 text-center space-y-4">
                  <div className="text-6xl">💌</div>
                  <h3 className="text-2xl font-black text-on-surface">已发送确认</h3>
                  <p className="text-on-surface-variant">
                    你已确认愿意交换联系方式。
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-sm">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                    等待对方确认...
                  </div>
                </div>
              </div>
            )}

            {/* Round 3: 对方已确认，等待我 */}
            {roundStatus.currentRound === 3 && !roundStatus.iConfirmed && roundStatus.partnerConfirmed && (
              <div className="space-y-6">
                <div className="glass-card rounded-[2rem] p-10 text-center space-y-6 border border-pink-200/50 bg-gradient-to-br from-pink-50/80 to-white">
                  <div className="text-6xl">💌</div>
                  <h3 className="text-2xl font-black text-on-surface">对方已确认！</h3>
                  <p className="text-on-surface-variant">
                    {partnerDisplayName} 愿意与你交换联系方式。
                    <br />
                    你是否也愿意？
                  </p>
                  <button
                    onClick={handleConfirmConnection}
                    disabled={submitting}
                    className="px-10 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-40 text-lg"
                  >
                    {submitting ? '处理中...' : '我愿意 💌'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        {hint && <div className="text-green-600 text-sm text-center">{hint}</div>}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatRoomPage;
