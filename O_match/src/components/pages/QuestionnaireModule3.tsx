import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils';
import { useQuestionnaireStore } from '@/store';
import { useQuestionnaireAutoSave } from '@/hooks/useQuestionnaireAutoSave';
import { useIncompleteQuestionPrompt } from '@/hooks/useIncompleteQuestionPrompt';
import { QuestionnaireTopProgress } from '@/components/common/QuestionnaireTopProgress';
import { calculateModule3Progress, calculateTotalProgress, MODULE_MAX_PROGRESS } from '@/utils/questionnaireProgress';

const modules = [
  { id: 1, name: '基础画像', icon: 'person', path: '/questionnaire/1' },
  { id: 2, name: '生活颗粒度', icon: 'bedtime', path: '/questionnaire/2' },
  { id: 3, name: '性格调色盘', icon: 'psychology', path: '/questionnaire/3' },
  { id: 4, name: '三观与旷野', icon: 'favorite', path: '/questionnaire/4' },
  { id: 5, name: '亲密关系说明书', icon: 'diversity_1', path: '/questionnaire/5' },
];

interface FormData {
  q1Slider: number;
  q1Preference: string;
  q2Slider: number;
  q2Preference: string;
  q3Slider: number;
  q3Preference: string;
  q4Slider: number;
  q4Preference: string;
  q5Slider: number;
  q5Preference: string;
  q6Slider: number;
  q6Preference: string;
  q7Slider: number;
  q7Preference: string;
  q8Slider: number;
  q8Preference: string;
  q9Slider: number;
  q9Preference: string;
  q10Slider: number;
  q10Preference: string;
}

const QuestionnaireModule3: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const currentModule = moduleId ? parseInt(moduleId) : 3;
  const { moduleProgress, setModuleProgress } = useQuestionnaireStore();

  const {
    formData,
    setFormData,
    saveState,
    lastSavedAt,
    isHydrated,
    persistNow,
  } = useQuestionnaireAutoSave<FormData>({
    moduleKey: 'module3',
    initialData: {
      q1Slider: 2, q1Preference: '',
      q2Slider: 2, q2Preference: '',
      q3Slider: 2, q3Preference: '',
      q4Slider: 2, q4Preference: '',
      q5Slider: 2, q5Preference: '',
      q6Slider: 2, q6Preference: '',
      q7Slider: 2, q7Preference: '',
      q8Slider: 2, q8Preference: '',
      q9Slider: 2, q9Preference: '',
      q10Slider: 2, q10Preference: '',
    },
  });

  const { incompleteHintId, focusFirstIncomplete } = useIncompleteQuestionPrompt();

  // 计算当前模块已完成题目数（只有 preference 选项选择后才计入完成度）
  const currentModuleProgress = calculateModule3Progress(formData);

  // 将当前模块进度存入 store
  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setModuleProgress(3, currentModuleProgress);
  }, [currentModuleProgress, isHydrated, setModuleProgress]);

  // 首次加载时自动滚动到第一个未完成的题目
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const questions = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i + 1}`,
      completed: formData[`q${i + 1}Preference` as keyof FormData] !== '',
    }));
    requestAnimationFrame(() => focusFirstIncomplete(questions));
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算总进度（33题）
  const totalProgress = calculateTotalProgress(moduleProgress);

  const updateFormData = (field: keyof FormData, value: number | string) => {
    // 当 slider 值改变时，同步更新 preference（如果 preference 为空）
    if (field.toString().includes('Slider')) {
      const qNum = field.toString().replace('Slider', '');
      const prefKey = `${qNum}Preference` as keyof FormData;
      if (value !== 2 && formData[prefKey] === '') {
        // 用户移动了 slider 但还没选 preference，不做额外处理
        setFormData((prev) => ({ ...prev, [field]: value }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextModule = async () => {
    // 找到第一个未完成的题目（需要 preference 选项选择后才算完成）
    const questions = [
      { id: 'q1', completed: formData.q1Preference !== '' },
      { id: 'q2', completed: formData.q2Preference !== '' },
      { id: 'q3', completed: formData.q3Preference !== '' },
      { id: 'q4', completed: formData.q4Preference !== '' },
      { id: 'q5', completed: formData.q5Preference !== '' },
      { id: 'q6', completed: formData.q6Preference !== '' },
      { id: 'q7', completed: formData.q7Preference !== '' },
      { id: 'q8', completed: formData.q8Preference !== '' },
      { id: 'q9', completed: formData.q9Preference !== '' },
      { id: 'q10', completed: formData.q10Preference !== '' },
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
    // 向前跳转：检查当前模块是否完成
    if (nextModuleId > currentModule) {
      const questions = [
        { id: 'q1', completed: formData.q1Preference !== '' },
        { id: 'q2', completed: formData.q2Preference !== '' },
        { id: 'q3', completed: formData.q3Preference !== '' },
        { id: 'q4', completed: formData.q4Preference !== '' },
        { id: 'q5', completed: formData.q5Preference !== '' },
        { id: 'q6', completed: formData.q6Preference !== '' },
        { id: 'q7', completed: formData.q7Preference !== '' },
        { id: 'q8', completed: formData.q8Preference !== '' },
        { id: 'q9', completed: formData.q9Preference !== '' },
        { id: 'q10', completed: formData.q10Preference !== '' },
      ];

      if (focusFirstIncomplete(questions)) {
        return;
      }
    }

    // 检查目标模块之前的所有模块是否都已完成
    for (let m = 1; m < nextModuleId; m++) {
      if (m === currentModule) continue;
      const key = `module${m}` as keyof typeof MODULE_MAX_PROGRESS;
      if (moduleProgress[key] < MODULE_MAX_PROGRESS[key]) {
        navigate(`/questionnaire/${m}`);
        return;
      }
    }

    navigate(`/questionnaire/${nextModuleId}`);
  };

  // 渲染 Range Slider - 与HTML完全一致
  const renderSlider = (value: number, onChange: (v: number) => void, leftLabel: string, rightLabel: string, leftEmoji: string, rightEmoji: string) => (
    <div className="bg-surface-container-lowest/80 ios-blur p-8 rounded-3xl outline outline-1 outline-white/40 shadow-sm space-y-8">
      <div className="flex flex-col gap-6">
        <div className="w-full flex flex-col items-center gap-4 relative">
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="cursor-pointer w-full"
            style={{
              WebkitAppearance: 'none',
              height: '4px',
              background: '#dbc2b2',
              borderRadius: '2px',
              outline: 'none',
              position: 'relative',
              zIndex: 10,
            }}
          />
          {/* 自定义滑块样式 - 刻度穿过圆心 */}
          <style>{`
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              height: 24px;
              width: 24px;
              border-radius: 50%;
              background: #fdf9f3;
              cursor: pointer;
              border: 4px solid #944a00;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              position: relative;
              z-index: 20;
            }
            input[type=range]::-webkit-slider-thumb:active {
              transform: scale(1.1);
            }
          `}</style>
          {/* 刻度标记 - 调整位置使刻度穿过滑块圆心 */}
          <div className="flex justify-between w-full px-2 absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ marginTop: '-2px' }}>
            <span className="w-0.5 bg-outline-variant/40" style={{ height: '32px' }}></span>
            <span className="w-0.5 bg-outline-variant/40" style={{ height: '32px' }}></span>
            <span className="w-1 bg-primary/20" style={{ height: '32px' }}></span>
            <span className="w-0.5 bg-outline-variant/40" style={{ height: '32px' }}></span>
            <span className="w-0.5 bg-outline-variant/40" style={{ height: '32px' }}></span>
          </div>
          {/* 隐藏的刻度容器用于占位 */}
          <div className="flex justify-between w-full px-2 opacity-0">
            <span className="h-2 w-0.5"></span>
            <span className="h-4 w-0.5"></span>
            <span className="h-6 w-1"></span>
            <span className="h-4 w-0.5"></span>
            <span className="h-2 w-0.5"></span>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col items-start gap-1 w-1/3">
            <span className="text-lg">{leftEmoji}</span>
            <span className="text-sm font-bold text-on-surface">{leftLabel}</span>
          </div>
          <div className="flex flex-col items-end gap-1 w-1/3 text-right">
            <span className="text-lg">{rightEmoji}</span>
            <span className="text-sm font-bold text-on-surface">{rightLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染偏好选择卡片 - 使用 div 替代 input radio 以支持取消选择
  const renderPreferenceCards = (
    value: string,
    onChange: (v: string) => void,
    options: { value: string; emoji: string; label: string }[]
  ) => (
    <div className="grid grid-cols-3 gap-3">
      {options.map((opt) => (
        <div
          key={opt.value}
          onClick={() => onChange(formData[value as keyof FormData] === opt.value ? '' : opt.value)}
          className={cn(
            'flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low text-on-surface-variant cursor-pointer',
            formData[value as keyof FormData] === opt.value && 'bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white shadow-lg shadow-[#F28C38]/30',
            'transition-all shadow-sm active:scale-95'
          )}
        >
          <span className="text-lg mb-1">{opt.emoji}</span>
          <span className="text-xs font-bold">{opt.label}</span>
        </div>
      ))}
    </div>
  );

  // 问题配置
  const questions = [
    {
      id: 1,
      category: '社交充能参数',
      question: '1. 连续熬夜赶完了一个大作业，迎来一个空闲的周末，你更倾向于如何"回血"？',
      leftLabel: '绝对独处',
      rightLabel: '绝对群居',
      leftEmoji: '🛌',
      rightEmoji: '🪩',
      sliderKey: 'q1Slider' as keyof FormData,
      prefKey: 'q1Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 2,
      category: '',
      question: '2. 刚结束一场必须参加的集体活动，回到宿舍后的你通常会？',
      leftLabel: '社交断电',
      rightLabel: '社交续杯',
      leftEmoji: '🔕',
      rightEmoji: '📱',
      sliderKey: 'q2Slider' as keyof FormData,
      prefKey: 'q2Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 3,
      category: '秩序掌控参数',
      question: '3. 面对下个月底才截止的重磅期末 Project，你的真实执行状态是？',
      leftLabel: 'Deadline战士',
      rightLabel: '无情甘特图机器',
      leftEmoji: '🔥',
      rightEmoji: '📅',
      sliderKey: 'q3Slider' as keyof FormData,
      prefKey: 'q3Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 4,
      category: '',
      question: '4. 你的日常生活通常呈现出怎样的状态？',
      leftLabel: '即兴流玩家',
      rightLabel: '系统化人生',
      leftEmoji: '🎲',
      rightEmoji: '🗂️',
      sliderKey: 'q4Slider' as keyof FormData,
      prefKey: 'q4Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 5,
      category: '情绪阻尼器参数',
      question: '5. 跑了三天的代码突然全线报错 / 辛辛苦苦做的实验数据作废，那一瞬间你的反应？',
      leftLabel: '情绪海啸',
      rightLabel: '冷酷 Debug 机',
      leftEmoji: '🌊',
      rightEmoji: '🧊',
      sliderKey: 'q5Slider' as keyof FormData,
      prefKey: 'q5Preference' as keyof FormData,
      prefOptions: [
        { value: 'empathy', emoji: '🫂', label: '共情大师' },
        { value: 'rational', emoji: '⚓', label: '理性锚点' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 6,
      category: '',
      question: '6. 当你和重要的人发生误会或冷战时，你的第一反应更接近？',
      leftLabel: '情绪优先',
      rightLabel: '逻辑优先',
      leftEmoji: '🔥',
      rightEmoji: '🧩',
      sliderKey: 'q6Slider' as keyof FormData,
      prefKey: 'q6Preference' as keyof FormData,
      prefOptions: [
        { value: 'empathy', emoji: '🫂', label: '共情型' },
        { value: 'rational', emoji: '⚓', label: '理性型' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 7,
      category: '边界探索参数',
      question: '7. 如果要选一家餐厅度过周末，你的决策风格是？',
      leftLabel: '舒适区守卫者',
      rightLabel: '永远的探险家',
      leftEmoji: '🏰',
      rightEmoji: '🛸',
      sliderKey: 'q7Slider' as keyof FormData,
      prefKey: 'q7Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 8,
      category: '',
      question: '8. 面对一个你完全不了解的新领域，你的态度是？',
      leftLabel: '保守尝试',
      rightLabel: '主动探索',
      leftEmoji: '📕',
      rightEmoji: '🚀',
      sliderKey: 'q8Slider' as keyof FormData,
      prefKey: 'q8Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 9,
      category: '冲突应对参数',
      question: '9. 在小组作业中，你和组员对核心方案产生了严重分歧，你的态度是？',
      leftLabel: '真理利刃',
      rightLabel: '和平润滑剂',
      leftEmoji: '⚔️',
      rightEmoji: '🕊️',
      sliderKey: 'q9Slider' as keyof FormData,
      prefKey: 'q9Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
      ],
    },
    {
      id: 10,
      category: '',
      question: '10. 当朋友做了一件让你不舒服但"不算大事"的事情时，你更可能？',
      leftLabel: '直接指出',
      rightLabel: '自我消化',
      leftEmoji: '🧨',
      rightEmoji: '🧻',
      sliderKey: 'q10Slider' as keyof FormData,
      prefKey: 'q10Preference' as keyof FormData,
      prefOptions: [
        { value: 'similar', emoji: '🪞', label: '波段相似' },
        { value: 'complement', emoji: '🧩', label: '波段互补' },
        { value: 'natural', emoji: '⭕', label: '顺其自然' },
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
        navClassName="w-full"
      />

      {/* Hero Intro */}
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tight text-on-surface">性格调色盘</h1>
        <p className="text-on-surface-variant leading-relaxed text-lg mt-4">
          好看的皮囊千篇一律，契合的灵魂万里挑一。<br/>
          在这里，你可以选择寻找世界上另一个自己，也可以寻找那块填补你空白的拼图。
        </p>
      </header>

      {/* Question List */}
      <div className="space-y-16">
        {questions.map((q) => (
          <section key={q.id} id={`q${q.id}`} className="space-y-8 relative">
            {incompleteHintId === `q${q.id}` && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            {/* Category Tag */}
            {q.category && (
              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-black uppercase tracking-widest rounded-full">
                  {q.category}
                </span>
              </div>
            )}

            {/* Question Title */}
            {!q.category && (
              <h2 className="text-xl font-bold leading-snug">{q.question}</h2>
            )}
            {q.category && (
              <h2 className="text-xl font-bold leading-snug">{q.question}</h2>
            )}

            {/* Slider */}
            {renderSlider(
              formData[q.sliderKey] as number,
              (v) => updateFormData(q.sliderKey, v),
              q.leftLabel,
              q.rightLabel,
              q.leftEmoji,
              q.rightEmoji
            )}

            {/* Preference Cards */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-on-surface-variant/40 tracking-widest uppercase mb-4">希望对方与你：</p>
              {renderPreferenceCards(
                q.prefKey as string,
                (v) => updateFormData(q.prefKey, formData[q.prefKey as keyof FormData] === v ? '' : v),
                q.prefOptions
              )}
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
    </main>
  );
};

export default QuestionnaireModule3;