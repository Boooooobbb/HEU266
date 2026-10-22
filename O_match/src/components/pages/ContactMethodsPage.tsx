import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ContactMethod, ContactPlatform } from '@/services/contactMethodsService';
import { loadContactMethods, saveContactMethods } from '@/services/contactMethodsService';

const platformLabel: Record<ContactPlatform, string> = {
  wechat: '微信',
  qq: 'QQ',
  douyin: '抖音',
};

const platformPlaceholder: Record<ContactPlatform, string> = {
  wechat: '请输入微信号',
  qq: '请输入QQ号',
  douyin: '请输入抖音号',
};

const platformIcon: Record<ContactPlatform, string> = {
  wechat: 'chat_bubble',
  qq: 'alternate_email',
  douyin: 'music_note',
};

const ContactMethodsPage: React.FC = () => {
  const navigate = useNavigate();
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      const data = await loadContactMethods();
      if (mounted) {
        setMethods(data);
        setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const canSave = useMemo(() => methods.some((item) => item.value.trim()), [methods]);

  const handleValueChange = (platform: ContactPlatform, value: string) => {
    setMethods((prev) => prev.map((item) => (item.platform === platform ? { ...item, value } : item)));
  };

  const handleSave = async () => {
    setError('');
    setHint('');

    if (!canSave) {
      setError('请至少填写一种联系方式');
      return;
    }

    setSaving(true);
    const result = await saveContactMethods(methods);
    setSaving(false);

    if (!result.success) {
      setError(result.message || '保存失败，请稍后重试');
      return;
    }

    setHint('联系方式已保存。');
  };

  return (
    <main className="pt-12 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2">联系方式管理</h1>
      </div>

      <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)] space-y-5">
        {loading && <div className="text-on-surface-variant text-sm">加载中...</div>}

        {!loading && methods.map((item) => (
          <div key={item.platform} className="bg-surface-container-low rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 text-on-surface font-bold mb-3">
              <span className="material-symbols-outlined text-primary">{platformIcon[item.platform]}</span>
              <span>{platformLabel[item.platform]}</span>
            </div>
            <input
              value={item.value}
              onChange={(e) => handleValueChange(item.platform, e.target.value)}
              placeholder={platformPlaceholder[item.platform]}
              className="w-full rounded-2xl bg-surface-container-lowest border-none py-3 px-4 text-on-surface placeholder:text-outline/50 focus:ring-0 ghost-border"
            />
          </div>
        ))}

        {error && <div className="text-red-500 text-sm">{error}</div>}
        {hint && <div className="text-green-600 text-sm">{hint}</div>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full sunset-gradient text-white font-bold py-4 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存联系方式'}
        </button>
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
    </main>
  );
};

export default ContactMethodsPage;
