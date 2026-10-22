import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitFeedbackTicket } from '@/services/feedbackService';

const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('问题反馈');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');

    if (!content.trim()) {
      setError('请先描述你遇到的问题或建议');
      return;
    }

    setLoading(true);
    try {
      const result = await submitFeedbackTicket({
        type: type as '问题反馈' | '功能建议' | '体验优化' | '其他',
        content,
        contact,
        sourcePath: window.location.pathname,
      });

      if (result.success) {
        setHint(result.message || '反馈提交成功，感谢你的建议');
        setContent('');
        setContact('');
      } else {
        setError(result.message || '提交失败，请稍后重试');
      }
    } catch {
      setError('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-12 pb-44 px-4 md:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2">问题反馈</h1>
        <p className="text-on-surface-variant font-medium">告诉我们你遇到的问题或想法，我们会持续改进意配</p>
      </div>

      <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">反馈类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-surface-container-low border-none py-4 px-5 text-on-surface focus:ring-0 focus:outline-none ghost-border"
            >
              <option>问题反馈</option>
              <option>功能建议</option>
              <option>体验优化</option>
              <option>其他</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">详细内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="请描述问题出现在哪个页面、做了什么操作、期望结果是什么"
              className="mt-2 w-full rounded-2xl bg-surface-container-low border-none py-4 px-5 text-on-surface placeholder:text-outline/50 focus:ring-0 focus:outline-none ghost-border resize-y"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">联系方式（可选）</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="邮箱"
              className="mt-2 w-full rounded-2xl bg-surface-container-low border-none py-4 px-5 text-on-surface placeholder:text-outline/50 focus:ring-0 focus:outline-none ghost-border"
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}
          {hint && <div className="text-green-600 text-sm">{hint}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full sunset-gradient text-white font-bold py-4 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all"
          >
            {loading ? '提交中...' : '发送反馈'}
          </button>
        </form>
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

export default FeedbackPage;
