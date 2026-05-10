import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils';
import { useQuestionnaireStore } from '@/store';
import { useQuestionnaireAutoSave } from '@/hooks/useQuestionnaireAutoSave';
import { useIncompleteQuestionPrompt } from '@/hooks/useIncompleteQuestionPrompt';
import { QuestionnaireTopProgress } from '@/components/common/QuestionnaireTopProgress';
import { calculateModule4Progress, calculateTotalProgress } from '@/utils/questionnaireProgress';

const modules = [
  { id: 1, name: '基础画像', icon: 'person', path: '/questionnaire/1' },
  { id: 2, name: '生活颗粒度', icon: 'bedtime', path: '/questionnaire/2' },
  { id: 3, name: '性格调色盘', icon: 'psychology', path: '/questionnaire/3' },
  { id: 4, name: '三观与旷野', icon: 'favorite', path: '/questionnaire/4' },
  { id: 5, name: '亲密关系说明书', icon: 'diversity_1', path: '/questionnaire/5' },
];

interface FormData {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string;
}

const QuestionnaireModule4: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const currentModule = moduleId ? parseInt(moduleId) : 4;
  const { moduleProgress, setModuleProgress } = useQuestionnaireStore();

  const {
    formData,
    setFormData,
    saveState,
    lastSavedAt,
    isHydrated,
    persistNow,
  } = useQuestionnaireAutoSave<FormData>({
    moduleKey: 'module4',
    initialData: {
      q1: '',
      q2: '',
      q3: '',
      q4: '',
      q5: '',
      q6: '',
    },
  });

  const { incompleteHintId, focusFirstIncomplete } = useIncompleteQuestionPrompt();

  // 计算当前模块已完成题目数
  const currentModuleProgress = calculateModule4Progress(formData);

  // 将当前模块进度存入 store
  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setModuleProgress(4, currentModuleProgress);
  }, [currentModuleProgress, isHydrated, setModuleProgress]);

  // 首次加载时自动滚动到第一个未完成的题目
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const questions = Array.from({ length: 6 }, (_, i) => ({
      id: `q${i + 1}`,
      completed: formData[`q${i + 1}` as keyof FormData] !== '',
    }));
    requestAnimationFrame(() => focusFirstIncomplete(questions));
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算总进度（33题）
  const totalProgress = calculateTotalProgress(moduleProgress);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextModule = async () => {
    // 找到第一个未完成的题目
    const questions = [
      { id: 'q1', completed: formData.q1 !== '' },
      { id: 'q2', completed: formData.q2 !== '' },
      { id: 'q3', completed: formData.q3 !== '' },
      { id: 'q4', completed: formData.q4 !== '' },
      { id: 'q5', completed: formData.q5 !== '' },
      { id: 'q6', completed: formData.q6 !== '' },
    ];

    if (focusFirstIncomplete(questions)) {
      return;
    }

    if (currentModule < 5) {
      await persistNow(formData);
      navigate(`/questionnaire/${currentModule + 1}`);
    }
  };

  const handleModuleNavigate = (nextModuleId: number) => {
    if (nextModuleId > currentModule) {
      const questions = [
        { id: 'q1', completed: formData.q1 !== '' },
        { id: 'q2', completed: formData.q2 !== '' },
        { id: 'q3', completed: formData.q3 !== '' },
        { id: 'q4', completed: formData.q4 !== '' },
        { id: 'q5', completed: formData.q5 !== '' },
        { id: 'q6', completed: formData.q6 !== '' },
      ];

      if (focusFirstIncomplete(questions)) {
        return;
      }
    }

    navigate(`/questionnaire/${nextModuleId}`);
  };

  // 渲染选项卡片 - 与HTML完全一致
  const renderOptionCard = (
    emoji: string,
    title: string,
    description: string,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      className={cn(
        'group p-6 rounded-2xl transition-all duration-300 text-left border-2 border-transparent w-full',
        isSelected
          ? 'bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white shadow-lg shadow-[#F28C38]/30'
          : 'bg-stone-50/80 text-[#554337] shadow-[0_8px_32px_0_rgba(28,28,24,0.06)] hover:border-primary/20'
      )}
    >
      <div className={cn('text-3xl mb-3', !isSelected && 'grayscale opacity-50')}>{emoji}</div>
      <div className={cn('font-bold mb-1', isSelected && 'text-white')}>{title}</div>
      <div className={cn('text-sm opacity-80', isSelected ? 'text-white/90' : '')}>{description}</div>
    </button>
  );

  // 问题配置
  const questions = [
    {
      id: 1,
      key: 'q1' as keyof FormData,
      question: '1. 你突然获得一笔 5000 元的"意外之财"，你更倾向于如何使用？',
      options: [
        { value: 'save', emoji: '🏦', title: '理性储蓄派（长期主义）', desc: '大部分存起来或用于未来，消费会谨慎规划。' },
        { value: 'balance', emoji: '⚖️', title: '平衡分配派（规划享受）', desc: '一部分存起来，一部分用于奖励自己。' },
        { value: 'enjoy', emoji: '🎉', title: '即时享乐派（体验优先）', desc: '直接用来提升当下幸福感，钱的意义就是"花掉"。' },
      ],
    },
    {
      id: 2,
      key: 'q2' as keyof FormData,
      question: '2. 面对毕业后的去向选择，你更接近哪种想法？',
      options: [
        { value: 'clear', emoji: '🧭', title: '清晰路径型（目标导向）', desc: '已经有明确规划，并且在为之持续准备。' },
        { value: 'flow', emoji: '🌊', title: '顺势而为型（弹性发展）', desc: '有大致方向，但会根据机会和现实情况灵活调整。' },
        { value: 'explore', emoji: '🧪', title: '探索试错型（开放尝试）', desc: '不急着定方向，更愿意多尝试不同可能。' },
      ],
    },
    {
      id: 3,
      key: 'q3' as keyof FormData,
      question: '3. 当学业/工作压力很大，同时另一半希望你多花时间陪伴时，你更可能？',
      options: [
        { value: 'task', emoji: '🎯', title: '任务优先型', desc: '先把眼前最重要的事情做好，关系可以稍微往后放一放。' },
        { value: 'balance', emoji: '⚖️', title: '尝试平衡型', desc: '尽量协调时间，两边都不想放弃，但可能都会有一点妥协。' },
        { value: 'love', emoji: '❤️', title: '关系优先型', desc: '会优先保证陪伴和情感连接，认为关系本身就是最重要的事。' },
      ],
    },
    {
      id: 4,
      key: 'q4' as keyof FormData,
      question: '4. 如果有一个机会去一个陌生城市发展，但存在不确定性 vs 留在熟悉环境稳定发展"，你更倾向？',
      options: [
        { value: 'stable', emoji: '🏠', title: '稳定优先', desc: '更看重安全感和确定性，不愿意承担太多未知风险。' },
        { value: 'weigh', emoji: '⚖️', title: '权衡决策', desc: '会综合考虑收益与风险，在可控范围内尝试。' },
        { value: 'adventure', emoji: '🚀', title: '冒险驱动', desc: '更愿意抓住可能改变人生的机会，即使风险较大。' },
      ],
    },
    {
      id: 5,
      key: 'q5' as keyof FormData,
      question: '5. 在确定关系前的日常相处中，你更认可哪种方式？',
      options: [
        { value: 'clear', emoji: '🧾', title: '边界清晰型', desc: '倾向 AA 或较明确的分担，认为清晰是关系稳定的基础。' },
        { value: 'flex', emoji: '⚖️', title: '弹性分担型', desc: '大体均衡，但不刻意计算，谁方便谁多付一点。' },
        { value: 'emotion', emoji: '🎁', title: '情感驱动型', desc: '不太在意具体分配，更看重"愿意为对方付出"的感觉。' },
      ],
    },
    {
      id: 6,
      key: 'q6' as keyof FormData,
      question: '6. 一个完全自由的周末，你更理想的状态是？',
      options: [
        { value: 'improve', emoji: '📈', title: '自我提升型', desc: '学习技能、健身、阅读，让自己变得更好。' },
        { value: 'balance', emoji: '⚖️', title: '平衡生活型', desc: '一部分时间放松，一部分时间做有意义的事。' },
        { value: 'relax', emoji: '🛋️', title: '纯放松型', desc: '彻底休息娱乐，什么都不想做才是最好的恢复。' },
      ],
    },
  ];

  return (
    <main className="pt-12 pb-32 px-4 max-w-3xl mx-auto min-h-[1024px]">
      {/* Sticky Progress Bar & Section Navigation */}
      <QuestionnaireTopProgress
        modules={modules}
        currentModule={currentModule}
        totalProgress={totalProgress}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        onNavigate={handleModuleNavigate}
      />

      {/* Survey Content Area */}
      <section className="space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight text-on-surface">三观与旷野</h1>
          <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
            三观没有标准答案，但频率相近的人，总能在同一片旷野里看见相同的风景。这里不谈对错，只寻找那个在人生岔路口，愿意和你望向同一方向的人。
          </p>
        </div>

        {/* Question Blocks */}
        <div className="space-y-16">
          {questions.map((q) => (
            <section key={q.id} id={q.key as string} className="space-y-6 relative">
              {incompleteHintId === q.key && (
                <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                  请完成此题
                </div>
              )}
              <label className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
                {q.question}
              </label>
              <div className="grid grid-cols-1 gap-4">
                {q.options.map((opt) => (
                  <div key={opt.value}>
                    {renderOptionCard(
                      opt.emoji,
                      opt.title,
                      opt.desc,
                      formData[q.key] === opt.value,
                      () => updateFormData(q.key, formData[q.key] === opt.value ? '' : opt.value)
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Action Area */}
        <div className="pt-12 flex justify-center flex-col items-center gap-4">
          <button
            onClick={nextModule}
            className="w-full py-5 rounded-full bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white font-black tracking-widest text-lg shadow-xl shadow-[#F28C38]/30 active:scale-95 transition-all"
          >
            继续探索下一个维度
          </button>
        </div>
      </section>
    </main>
  );
};

export default QuestionnaireModule4;