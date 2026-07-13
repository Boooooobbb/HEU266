import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBlockStatus, resolveChatContext } from '@/services/chatService';
import { loadContactMethods } from '@/services/contactMethodsService';
import { getUserMatchReport } from '@/services/matchingService';
import { hasSubmittedQuestionnaire, loadQuestionnaire } from '@/services/questionnaireService';
import type { MatchReportData } from '@/types';

const MATCH_WEEKDAY = 3; // 周三
const MATCH_HOUR = 12;

const getNextMatchTime = (): Date => {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(MATCH_HOUR, 0, 0, 0);

  const currentDay = next.getDay();
  const diffDays = (MATCH_WEEKDAY - currentDay + 7) % 7;
  next.setDate(next.getDate() + diffDays);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }

  return next;
};

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}天 ${String(hours).padStart(2, '0')}时 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`;
};

const ChatEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entryProgress, setEntryProgress] = useState(10);
  const [needsQuestionnaire, setNeedsQuestionnaire] = useState(false);
  const [nextMatchTime, setNextMatchTime] = useState<Date>(() => getNextMatchTime());
  const [countdownText, setCountdownText] = useState('');
  const forceNoMatchDemo =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'no-match-demo';

  useEffect(() => {
    const tick = () => {
      const next = getNextMatchTime();
      setNextMatchTime(next);
      setCountdownText(formatRemaining(next.getTime() - Date.now()));
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setEntryProgress(100);
      return;
    }

    let progress = 10;
    setEntryProgress(progress);

    const timer = window.setInterval(() => {
      const target = 93;
      const step = Math.max(0.7, (target - progress) * 0.08);
      progress = Math.min(target, progress + step);
      setEntryProgress(progress);
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (forceNoMatchDemo) {
        if (!mounted) return;
        setNeedsQuestionnaire(false);
        setLoading(false);
        return;
      }

      // 先从 DB 同步问卷到 localStorage（解决 API 创建用户无本地数据的问题）
      await loadQuestionnaire();

      if (!hasSubmittedQuestionnaire()) {
        if (!mounted) return;
        setNeedsQuestionnaire(true);
        setLoading(false);
        return;
      }

      const context = await resolveChatContext();
      if (!mounted) return;

      if (context.partnerId) {
        // 并行加载：匹配报告 + 联系方式 + 拉黑状态
        const [matchReport, contactMethods, blockStatus] = await Promise.all([
          getUserMatchReport().catch((): MatchReportData | null => null),
          loadContactMethods(),
          getBlockStatus(context.matchId, context.partnerId ?? null),
        ]);

        if (!mounted) return;

        setEntryProgress(100);

        // Give the browser one short frame window to paint the completed bar.
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 120);
        });

        if (!mounted) return;

        navigate('/chat', {
          replace: true,
          state: {
            chatContext: context,
            matchReport,
            contactMethods,
            isBlocked: blockStatus.isBlocked,
          },
        });
        return;
      }

      setLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [navigate, forceNoMatchDemo]);

  if (loading) {
    const currentProgress = Math.min(100, Math.round(entryProgress));
    // 更新加载文案，面向冰破体验
    const stageText = currentProgress < 40
      ? '正在准备破冰之旅'
      : currentProgress < 80
        ? '正在分析你们的共鸣时刻'
        : '即将开启破冰';

    return (
      <main className="pt-24 pb-32 px-4 md:px-8 max-w-4xl mx-auto">
        <div className="glass-card ghost-border rounded-[2rem] p-8 md:p-12 text-center space-y-5">
          <div className="text-sm md:text-base font-semibold text-on-surface">{stageText}</div>

          <div className="mx-auto w-full max-w-md">
            <div className="relative h-2.5 rounded-full bg-orange-100/90 overflow-hidden" aria-label="加载进度">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 transition-[width] duration-200 ease-out"
                style={{ width: `${currentProgress}%` }}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.48)_45%,transparent_70%)] animate-pulse" />
            </div>
          </div>

          <div className="text-xs text-on-surface-variant">
            {currentProgress}%
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-4xl mx-auto">
      <div className="glass-card rounded-[2rem] p-8 md:p-12 text-center shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-primary-container/50 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-3xl">notifications</span>
        </div>

        {needsQuestionnaire ? (
          <>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface mb-3">先完成问卷，再开启破冰</h1>
            <p className="text-on-surface-variant leading-relaxed max-w-xl mx-auto">
              为了给你找到更合拍的对象，请先完成并提交问卷。
              填写越认真，后续匹配和破冰体验会越好。
            </p>
          </>
        ) : (
          <>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface mb-3">你的缘分还在路上</h1>
            <p className="text-on-surface-variant leading-relaxed max-w-xl mx-auto">
              现在还没有匹配对象，不是你不够好，而是我们想把更合拍的人认真交到你手里。
              再给缘分一点点时间，我们会在下一次匹配时继续为你认真寻找。
            </p>

            <div className="mt-6 max-w-xl mx-auto bg-surface-container-low rounded-2xl px-5 py-4">
              <div className="text-xs text-on-surface-variant mb-1">距离下次匹配（每周三 12:00）还有</div>
              <div className="font-black text-xl md:text-2xl text-primary tracking-tight">{countdownText}</div>
              <div className="text-[11px] text-on-surface-variant mt-1">
                预计时间：{nextMatchTime.toLocaleDateString('zh-CN')} {nextMatchTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            </div>
          </>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/questionnaire/1"
            className="px-6 py-3 rounded-full bg-surface-container-low hover:bg-surface-container-lowest text-on-surface font-bold transition-colors"
          >
            完善并提交问卷
          </Link>
          {needsQuestionnaire && (
            <Link
              to="/chat-entry?mode=no-match-demo"
              className="px-6 py-3 rounded-full bg-primary-container/60 text-primary font-bold hover:opacity-90 transition-opacity"
            >
              仅供测试：查看暂无匹配页
            </Link>
          )}
          {!needsQuestionnaire && (
            <Link
              to="/chat"
              className="px-6 py-3 rounded-full sunset-gradient text-white font-bold shadow-lg shadow-orange-700/10"
            >
              仅供测试：前往破冰页
            </Link>
          )}
        </div>
      </div>
    </main>
  );
};

export default ChatEntryPage;
