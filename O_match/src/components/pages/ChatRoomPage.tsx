import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatApi } from '@/api';
import { hasSupabaseConfig } from '@/lib/supabase';
import { useCountdown } from '@/hooks';
import type { ChatContext, ChatMessageItem } from '@/services/chatService';
import {
  blockUser,
  getBlockStatus,
  loadMessages,
  reportUser,
  resolveChatContext,
  sendContactCard,
  sendMessage,
  subscribeMessages,
  setActiveLocalChatMatchId,
  unblockUser,
} from '@/services/chatService';
import { cancelMatching } from '@/services/matchingService';
import type { ContactMethod } from '@/services/contactMethodsService';
import { loadContactMethods } from '@/services/contactMethodsService';
import {
  addLocalNotificationForUser,
  markLocalNotificationsReadForCurrentUserByKind,
} from '@/services/notificationService';

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

const platformIconMap: Record<string, string> = {
  wechat: 'chat_bubble',
  qq: 'alternate_email',
  douyin: 'music_note',
};

const quickContactPlatforms: ContactMethod['platform'][] = ['wechat', 'qq', 'douyin'];

interface ChatRouteState {
  chatContext?: ChatContext;
  chatPreload?: {
    messages: ChatMessageItem[];
    contactMethods: ContactMethod[];
    isBlocked: boolean;
  };
}

const ChatRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as ChatRouteState | null) ?? null;
  const preloadedContext = routeState?.chatContext ?? null;
  const preloadedData = routeState?.chatPreload ?? null;
  const [messages, setMessages] = useState<ChatMessageItem[]>(preloadedData?.messages ?? []);
  const [inputValue, setInputValue] = useState('');
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>(preloadedData?.contactMethods ?? []);
  const [chatContext, setChatContext] = useState<ChatContext | null>(preloadedContext);
  const [loading, setLoading] = useState(!preloadedData);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [isBlocked, setIsBlocked] = useState(preloadedData?.isBlocked ?? false);
  const [blocking, setBlocking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const countdown = useCountdown({ initialSeconds: 72 * 3600 });

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    const run = async () => {
      try {
        setLoading(true);
        setError('');

        const context = preloadedContext ?? await resolveChatContext();
        if (!mounted) return;

        setChatContext(context);

        if (preloadedData) {
          setMessages(preloadedData.messages);
          setContactMethods(preloadedData.contactMethods);
          setIsBlocked(preloadedData.isBlocked);
        } else {
          const [loadedMessages, methods] = await Promise.all([
            loadMessages(context.matchId),
            loadContactMethods(),
          ]);
          if (!mounted) return;

          setMessages(loadedMessages);
          setContactMethods(methods);

          void getBlockStatus(context.matchId, context.partnerId ?? null).then((blockState) => {
            if (!mounted) return;
            setIsBlocked(blockState.isBlocked);
          });
        }

        setLoading(false);

        setActiveLocalChatMatchId(context.matchId);
        void markLocalNotificationsReadForCurrentUserByKind('chat_message');

        void chatApi.markAsRead(context.matchId).then(() => {
          window.dispatchEvent(new Event('chat-unread-updated'));
        });

        void subscribeMessages(context.matchId, (newMessage) => {
          setMessages((prev) => {
            if (prev.some((item) => item.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }).then((nextUnsubscribe) => {
          if (!mounted) {
            nextUnsubscribe();
            return;
          }

          unsubscribe = nextUnsubscribe;
        });
      } catch {
        if (!mounted) return;
        setError('加载聊天失败，请稍后重试');
        setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
      setActiveLocalChatMatchId(null);
      unsubscribe();
    };
  }, [preloadedContext, preloadedData]);

  useEffect(() => {
    if (loading || !messagesEndRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
    });
  }, [loading, messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatContext) return;

    const messageText = inputValue.trim();
    const isOptimisticMode = hasSupabaseConfig;
    const optimisticId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    setSending(true);
    setError('');

    if (isOptimisticMode) {
      const optimisticMessage: ChatMessageItem = {
        id: optimisticId,
        sender: 'me',
        content: messageText,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        type: 'text',
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setInputValue('');
    }

    const result = await sendMessage(chatContext.matchId, messageText);

    setSending(false);

    if (!result.success || !result.message) {
      if (isOptimisticMode) {
        setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
        setInputValue(messageText);
      }
      setError(result.error || '发送失败，请稍后重试');
      return;
    }

    if (isOptimisticMode) {
      const remoteMessage = result.message as ChatMessageItem;
      setMessages((prev) => {
        const remoteAlreadyExists = prev.some((item) => item.id === remoteMessage.id && item.id !== optimisticId);
        if (remoteAlreadyExists) {
          return prev.filter((item) => item.id !== optimisticId);
        }

        return prev.map((item) => (item.id === optimisticId ? remoteMessage : item));
      });
    }

    if (chatContext.partnerId) {
      void addLocalNotificationForUser(chatContext.partnerId, {
        kind: 'chat_message',
        title: '新消息',
        content: messageText.slice(0, 32),
        linkPath: '/chat-entry',
        channel: 'in_app',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    if (!isOptimisticMode) {
      setMessages((prev) => [...prev, result.message as ChatMessageItem]);
      setInputValue('');
    }
  };

  const handleReportPartner = async () => {
    if (!chatContext) return;

    const reason = window.prompt('请输入举报原因（必填）');
    if (!reason) {
      return;
    }

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

    const confirmed = window.confirm('确认要拉黑该用户吗？拉黑后将无法继续互发消息，并且之后可以在这里取消拉黑。');
    if (!confirmed) {
      return;
    }

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

    const confirmed = window.confirm('确认要取消拉黑吗？取消后可以继续互发消息。');
    if (!confirmed) {
      return;
    }

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

    const confirmed = window.confirm('确认结束这段匹配吗？结束后将返回等待页，并停止当前聊天。');
    if (!confirmed) {
      return;
    }

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

  const handleSendContact = async (platform: string, value: string) => {
    if (!chatContext) return;

    setError('');
    setHint('');

    const confirmed = window.confirm(`确认发送${platformLabelMap[platform] || platform}：${value} 吗？`);
    if (!confirmed) {
      return;
    }

    const result = await sendContactCard(chatContext.matchId, platformLabelMap[platform] || platform, value);
    if (!result.success || !result.message) {
      setError(result.error || '发送失败，请稍后重试');
      return;
    }

    setMessages((prev) => [...prev, result.message as ChatMessageItem]);
    setHint(`${platformLabelMap[platform] || platform} 已发送`);
  };

  const handleQuickContactAction = async (platform: ContactMethod['platform']) => {
    const targetMethod = contactMethods.find((item) => item.platform === platform);
    const canSend = Boolean(targetMethod?.value.trim());

    if (!canSend) {
      navigate('/contact-methods');
      return;
    }

    await handleSendContact(platform, targetMethod?.value || '');
  };

  const mobileBallSize = 56;
  const mobilePanelApproxHeight = 240;
  const dragThresholdPx = 6;

  const partnerDisplayName = chatContext?.partnerNickname?.trim() || '橘子同学';
  const partnerStageText = chatContext?.partnerStage
    ? (stageLabelMap[chatContext.partnerStage] || chatContext.partnerStage)
    : '阶段未公开';
  const partnerMatchRateText = typeof chatContext?.matchRate === 'number'
    ? `${Math.round(chatContext.matchRate)}% 灵魂契合`
    : '灵魂契合待生成';

  const [mobileWidget, setMobileWidget] = useState(() => {
    const initialX = typeof window === 'undefined' ? 16 : Math.max(16, window.innerWidth - mobileBallSize - 16);
    const initialY = typeof window === 'undefined'
      ? 220
      : Math.max(120, window.innerHeight - mobileBallSize - 220);

    return {
      x: initialX,
      y: initialY,
      expanded: false,
    };
  });

  const mobileDragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const clampMobileWidget = useCallback((x: number, y: number) => {
    const viewportW = typeof window === 'undefined' ? 375 : window.innerWidth;
    const viewportH = typeof window === 'undefined' ? 812 : window.innerHeight;

    const minX = 12;
    const maxX = Math.max(minX, viewportW - mobileBallSize - 12);
    const minY = 88;
    const maxY = Math.max(
      minY,
      viewportH - mobileBallSize - 120
    );

    const clampedX = Math.min(maxX, Math.max(minX, x));
    const clampedY = Math.min(maxY, Math.max(minY, y));

    return { x: clampedX, y: clampedY };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setMobileWidget((prev) => {
        const nextPos = clampMobileWidget(prev.x, prev.y);
        if (nextPos.x === prev.x && nextPos.y === prev.y) return prev;
        return { ...prev, ...nextPos };
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampMobileWidget]);

  return (
    <div className="relative z-10 pt-32 md:pt-44 pb-24">
      {/* Floating Match Actions (Desktop) */}
      <div className="hidden md:block fixed top-28 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-7xl pointer-events-none">
        <div className="rounded-[999px] px-5 py-4 flex flex-col items-start md:flex-row md:flex-wrap md:items-center md:justify-between gap-4 shadow-[0_16px_40px_-16px_rgba(148,74,0,0.55)] pointer-events-auto border border-orange-300/70 bg-gradient-to-br from-orange-200/88 via-orange-100/88 to-orange-50/88 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-2xl shadow border-2 border-white">🍊</div>
            <div>
              <div className="font-bold text-on-surface">{partnerDisplayName}</div>
              <div className="text-xs text-on-surface-variant">
                {partnerMatchRateText} · {partnerStageText}
              </div>
            </div>
          </div>
          <div className="w-full md:w-auto grid grid-cols-2 gap-2 md:flex md:items-center md:gap-4 md:flex-wrap md:justify-end">
            <div className="w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-3 py-1.5 bg-orange-50/95 border border-orange-300/60 rounded-full">
              <span className="material-symbols-outlined text-orange-700 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              <span className="text-xs font-bold text-orange-800">{countdown.formatted}</span>
            </div>
            <button
              onClick={handleEndMatch}
              className="w-full md:w-auto px-4 py-2 text-xs font-bold text-white rounded-xl bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
            >
              结束匹配
            </button>
            <button
              onClick={handleReportPartner}
              className="w-full md:w-auto px-4 py-1.5 text-xs font-bold text-[#A64B00] rounded-full border border-[#F2C28F] bg-[#FFE8CC] hover:bg-[#FFD9B0] transition-colors shadow-sm"
            >
              举报
            </button>
            {isBlocked ? (
              <button
                onClick={handleUnblockPartner}
                disabled={blocking}
                className="w-full md:w-auto px-4 py-1.5 text-xs font-bold text-orange-900 rounded-full border border-orange-300/80 bg-orange-100/90 hover:bg-orange-50 transition-colors shadow-sm disabled:opacity-40"
              >
                {blocking ? '处理中...' : '取消拉黑'}
              </button>
            ) : (
              <button
                onClick={handleBlockPartner}
                disabled={blocking}
                className="w-full md:w-auto px-4 py-1.5 text-xs font-bold text-white rounded-full border border-orange-500/70 bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-40"
              >
                {blocking ? '处理中...' : '拉黑'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Match Actions (Mobile) */}
      <div
        className="md:hidden fixed z-[60]"
        style={{ left: mobileWidget.x, top: mobileWidget.y }}
      >
        <div className="relative">
          {mobileWidget.expanded && (
            <div
              className="absolute right-0 bottom-full mb-3 w-[min(92vw,320px)] rounded-3xl p-4 shadow-[0_16px_40px_-16px_rgba(148,74,0,0.55)] border border-orange-300/70 bg-gradient-to-br from-orange-200/88 via-orange-100/88 to-orange-50/88 backdrop-blur-xl"
              style={{ maxHeight: `min(60vh, ${mobilePanelApproxHeight}px)` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-fixed flex items-center justify-center text-xl shadow border-2 border-white">🍊</div>
                <div className="min-w-0">
                  <div className="font-bold text-on-surface truncate">{partnerDisplayName}</div>
                  <div className="text-xs text-on-surface-variant truncate">
                    {partnerMatchRateText} · {partnerStageText}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-orange-50/95 border border-orange-300/60 rounded-2xl">
                  <span
                    className="material-symbols-outlined text-orange-700 text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    schedule
                  </span>
                  <span className="text-xs font-bold text-orange-800">{countdown.formatted}</span>
                </div>

                {isBlocked ? (
                  <button
                    onClick={handleUnblockPartner}
                    disabled={blocking}
                    className="w-full px-4 py-2 text-xs font-bold text-orange-900 rounded-2xl border border-orange-300/80 bg-orange-100/90 hover:bg-orange-50 transition-colors shadow-sm disabled:opacity-40"
                  >
                    {blocking ? '处理中...' : '取消拉黑'}
                  </button>
                ) : (
                  <button
                    onClick={handleBlockPartner}
                    disabled={blocking}
                    className="w-full px-4 py-2 text-xs font-bold text-white rounded-2xl border border-orange-500/70 bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-40"
                  >
                    {blocking ? '处理中...' : '拉黑'}
                  </button>
                )}

                <button
                  onClick={handleReportPartner}
                  className="w-full px-4 py-2 text-xs font-bold text-[#A64B00] rounded-2xl border border-[#F2C28F] bg-[#FFE8CC] hover:bg-[#FFD9B0] transition-colors shadow-sm"
                >
                  举报
                </button>

                <button
                  onClick={handleEndMatch}
                  className="col-span-2 w-full px-4 py-2 text-xs font-bold text-white rounded-2xl bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
                >
                  结束匹配
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`relative w-14 h-14 rounded-full glass-orb border border-white/70 flex items-center justify-center text-2xl select-none touch-none`}
            data-expanded={mobileWidget.expanded}
            aria-label={mobileWidget.expanded ? '收起匹配信息' : '展开匹配信息'}
            onPointerDown={(event) => {
              const target = event.currentTarget;
              try {
                target.setPointerCapture(event.pointerId);
              } catch {
                // ignore
              }

              mobileDragRef.current.pointerId = event.pointerId;
              mobileDragRef.current.startX = event.clientX;
              mobileDragRef.current.startY = event.clientY;
              mobileDragRef.current.originX = mobileWidget.x;
              mobileDragRef.current.originY = mobileWidget.y;
              mobileDragRef.current.moved = false;
            }}
            onPointerMove={(event) => {
              if (mobileDragRef.current.pointerId !== event.pointerId) return;

              const dx = event.clientX - mobileDragRef.current.startX;
              const dy = event.clientY - mobileDragRef.current.startY;

              if (!mobileDragRef.current.moved && Math.hypot(dx, dy) > dragThresholdPx) {
                mobileDragRef.current.moved = true;
              }

              const nextX = mobileDragRef.current.originX + dx;
              const nextY = mobileDragRef.current.originY + dy;
              const clamped = clampMobileWidget(nextX, nextY);
              setMobileWidget((prev) => ({ ...prev, ...clamped }));
            }}
            onPointerUp={(event) => {
              if (mobileDragRef.current.pointerId !== event.pointerId) return;
              mobileDragRef.current.pointerId = -1;

              if (!mobileDragRef.current.moved) {
                setMobileWidget((prev) => ({ ...prev, expanded: !prev.expanded }));
              }
            }}
          >
            <span className="relative z-10">🍊</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="mx-auto w-[92%] max-w-7xl space-y-6 pb-8">
        <div className="flex justify-center">
          <div className="bg-white/50 backdrop-blur-md border border-white/40 px-6 py-2.5 rounded-full text-[10px] font-black text-on-surface-variant/40 tracking-[0.2em] shadow-sm uppercase">
            缘分始于 2 天前
          </div>
        </div>

        {/* Message List */}
        <div className="space-y-8">
          {loading && <div className="text-sm text-on-surface-variant text-center">加载聊天中...</div>}
          {!loading && !chatContext?.partnerId && (
            <div className="text-sm text-on-surface-variant text-center">
              当前未找到有效匹配对象，已进入演示聊天模式。
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-4 max-w-full ${msg.sender === 'me' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-12 h-12 rounded-[1.25rem] flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white ${msg.sender === 'me' ? 'warm-gradient' : 'bg-primary-fixed'}`}>
                {msg.sender === 'me' ? '👤' : '🍊'}
              </div>
              <div className="space-y-2">
                <div className={`glass-card px-6 py-4 rounded-3xl shadow-sm text-[15px] text-on-surface leading-relaxed ${msg.sender === 'me' ? 'text-white warm-gradient rounded-br-none' : 'rounded-bl-none'} ${msg.type === 'contact_card' ? 'ring-1 ring-orange-300/50' : ''}`}>
                  {msg.type === 'contact_card' && (
                    <div className="text-[11px] uppercase tracking-wider opacity-80 mb-1">联系方式卡片</div>
                  )}
                  {msg.content}
                </div>
                <span className={`text-[11px] text-on-surface-variant/30 ml-2 font-medium ${msg.sender === 'me' ? 'mr-2' : 'ml-2'}`}>{msg.time}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} style={{ scrollMarginBottom: '200px' }} />
        </div>

        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        {hint && <div className="text-green-600 text-sm text-center">{hint}</div>}
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+165px)] md:bottom-[120px] left-0 right-0 z-[45] px-4 md:px-0">
        <div className="mx-auto w-[92%] max-w-7xl">
          <div className="glass-card rounded-[999px] px-4 py-3 md:px-5 md:py-4 shadow-md border-white/60">
            <div className="flex flex-wrap gap-2">
              {quickContactPlatforms.map((platform) => {
                const targetMethod = contactMethods.find((item) => item.platform === platform);
                const canSend = Boolean(targetMethod?.value.trim());

                return (
                  <button
                    key={platform}
                    onClick={() => {
                      void handleQuickContactAction(platform);
                    }}
                    className={`px-3 py-2 rounded-full text-xs font-bold transition-colors ${
                      !canSend
                        ? 'text-[#A64B00] bg-[#FFE8CC] border border-[#F2C28F] hover:bg-[#FFD9B0]'
                        : platform === 'wechat'
                          ? 'text-white bg-[#07C160] hover:bg-[#06AD56]'
                          : platform === 'qq'
                            ? 'text-white bg-[#2A8CFF] hover:bg-[#1E73E8]'
                            : 'text-white bg-[#121212] hover:bg-[#000000]'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {platformIconMap[platform] && (
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {platformIconMap[platform]}
                        </span>
                      )}
                      <span>{canSend ? `发送${platformLabelMap[platform] || platform}` : `设置${platformLabelMap[platform] || platform}`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Input Area */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] md:bottom-0 left-0 right-0 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-8 pt-4 bg-gradient-to-t from-[#fdf9f3] via-[#fdf9f3]/90 to-transparent z-50">
        <div className="mx-auto w-[92%] max-w-7xl">
          <div className="glass-card rounded-[2.5rem] p-2 shadow-lg flex items-center gap-2 border-white/70">
            <input
              className="flex-1 bg-transparent border-none rounded-2xl px-4 py-3 text-base focus:ring-0 placeholder:text-on-surface-variant/30 font-medium"
              placeholder="回复 Orange..."
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !chatContext || isBlocked}
              className="w-12 h-10 rounded-full warm-gradient text-white flex items-center justify-center shadow-md active:scale-95 transition-transform disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-xl">send</span>
            </button>
          </div>
        </div>
      </div>
      <div className="h-4 md:hidden" />
    </div>
  );
};

export default ChatRoomPage;