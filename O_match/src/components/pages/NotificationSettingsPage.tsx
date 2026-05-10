import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  defaultNotificationSettings,
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/services/notificationSettingsService';
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/notificationService';

const NotificationSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = React.useState<NotificationSettings>(defaultNotificationSettings);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [hint, setHint] = React.useState('');
  const [error, setError] = React.useState('');
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const [next, latestNotifications] = await Promise.all([
        loadNotificationSettings(),
        loadNotifications(30),
      ]);
      if (cancelled) return;
      setSettings(next);
      setNotifications(latestNotifications);
      setLoading(false);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = async (next: NotificationSettings) => {
    setSaving(true);
    setError('');
    setSettings(next);

    const result = await saveNotificationSettings(next);
    if (result.success) {
      setHint('设置已保存并同步到云端');
      window.setTimeout(() => setHint(''), 1200);
    } else {
      setError(result.message || '保存失败，请稍后重试');
    }

    setSaving(false);
  };

  const toggle = (key: keyof NotificationSettings) => {
    void updateSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const refreshNotifications = async () => {
    const latest = await loadNotifications(30);
    setNotifications(latest);
  };

  const handleMarkOneRead = async (id: string) => {
    setMarkingId(id);
    const result = await markNotificationRead(id);
    if (!result.success) {
      setError(result.message || '操作失败，请稍后重试');
    }
    await refreshNotifications();
    setMarkingId(null);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    const result = await markAllNotificationsRead();
    if (!result.success) {
      setError(result.message || '操作失败，请稍后重试');
    }
    await refreshNotifications();
    setMarkingAll(false);
  };

  if (loading) {
    return (
      <main className="pt-32 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
        <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] text-center text-on-surface-variant">
          正在加载通知设置...
        </div>
      </main>
    );
  }

  return (
    <main className="pt-32 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] relative overflow-hidden">

        <div className="relative">
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-3">通知提醒</h1>
          <p className="text-on-surface-variant mb-8">你可以在这里管理匹配相关提醒开关</p>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => toggle('halfHourCountdownReminder')}
              disabled={saving}
              className="w-full flex items-center justify-between p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] text-left"
            >
              <div>
                <div className="text-on-surface font-bold">匹配结果半小时倒计时提醒</div>
                <div className="text-on-surface-variant text-sm mt-1">在匹配结果发布前 30 分钟提醒你</div>
              </div>
              <span className={`inline-flex h-7 w-12 items-center rounded-full transition-colors ${settings.halfHourCountdownReminder ? 'bg-primary' : 'bg-outline-variant/60'}`}>
                <span className={`h-5 w-5 rounded-full bg-white transition-transform ${settings.halfHourCountdownReminder ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggle('matchResultReminder')}
              disabled={saving}
              className="w-full flex items-center justify-between p-6 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-[1.5rem] text-left"
            >
              <div>
                <div className="text-on-surface font-bold">匹配结果提醒</div>
                <div className="text-on-surface-variant text-sm mt-1">在本周匹配结果生成后通知你</div>
              </div>
              <span className={`inline-flex h-7 w-12 items-center rounded-full transition-colors ${settings.matchResultReminder ? 'bg-primary' : 'bg-outline-variant/60'}`}>
                <span className={`h-5 w-5 rounded-full bg-white transition-transform ${settings.matchResultReminder ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>
          </div>

          <div className="mt-12 border-t border-outline-variant/20 pt-8">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-lg md:text-xl font-bold text-on-surface">站内通知</h2>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll || notifications.length === 0}
                className="px-4 py-2 rounded-full text-xs font-bold bg-surface-container-low hover:bg-surface-container-lowest disabled:opacity-50"
              >
                {markingAll ? '处理中...' : '全部标记已读'}
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
                目前还没有新的站内通知。
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-4 border transition-colors ${
                      item.isRead
                        ? 'bg-surface-container-low border-transparent'
                        : 'bg-primary-container/20 border-primary/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!item.isRead && <span className="inline-block w-2 h-2 rounded-full bg-primary" />}
                          <h3 className="text-sm font-bold text-on-surface truncate">{item.title}</h3>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-1 whitespace-pre-wrap">{item.content}</p>
                        <p className="text-[11px] text-on-surface-variant/70 mt-2">
                          {new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}
                        </p>
                      </div>
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkOneRead(item.id)}
                          disabled={markingId === item.id}
                          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/70 hover:bg-white disabled:opacity-50"
                        >
                          {markingId === item.id ? '处理中...' : '标记已读'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 px-8 py-4 bg-surface-container-low hover:bg-surface-container-lowest transition-all duration-300 rounded-full text-on-surface-variant font-bold"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              返回个人资料
            </button>
          </div>
          {hint && <div className="mt-3 text-sm text-green-600 text-center font-medium">{hint}</div>}
          {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
        </div>
      </div>
    </main>
  );
};

export default NotificationSettingsPage;
