import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils';
import { useQuestionnaireStore } from '@/store';
import { joinMatching } from '@/services/matchingService';
import { useQuestionnaireAutoSave } from '@/hooks/useQuestionnaireAutoSave';
import { useIncompleteQuestionPrompt } from '@/hooks/useIncompleteQuestionPrompt';
import { QuestionnaireTopProgress } from '@/components/common/QuestionnaireTopProgress';
import { calculateModule5Progress, calculateTotalProgress, MODULE_MAX_PROGRESS } from '@/utils/questionnaireProgress';

const modules = [
  { id: 1, name: '基础画像', icon: 'person', path: '/questionnaire/1' },
  { id: 2, name: '生活颗粒度', icon: 'bedtime', path: '/questionnaire/2' },
  { id: 3, name: '性格调色盘', icon: 'psychology', path: '/questionnaire/3' },
  { id: 4, name: '三观与旷野', icon: 'favorite', path: '/questionnaire/4' },
  { id: 5, name: '亲密关系说明书', icon: 'diversity_1', path: '/questionnaire/5' },
];

interface FormData {
  q1: string;
  q2: string[];
  q3: string;
  q4: string;
  q5: string;
  q6: string;
  q7: string[];
}

const QuestionnaireModule5: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const currentModule = moduleId ? parseInt(moduleId) : 5;
  const { moduleProgress, setModuleProgress } = useQuestionnaireStore();

  const {
    formData,
    setFormData,
    saveState,
    lastSavedAt,
    isHydrated,
    persistNow,
  } = useQuestionnaireAutoSave<FormData>({
    moduleKey: 'module5',
    initialData: {
      q1: '',
      q2: [],
      q3: '',
      q4: '',
      q5: '',
      q6: '',
      q7: [],
    },
  });

  const { incompleteHintId, focusFirstIncomplete } = useIncompleteQuestionPrompt();

  // 计算当前模块已完成题目数
  const currentModuleProgress = calculateModule5Progress(formData);

  // 将当前模块进度存入 store
  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setModuleProgress(5, currentModuleProgress);
  }, [currentModuleProgress, isHydrated, setModuleProgress]);

  // 首次加载时自动滚动到第一个未完成的题目
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const questions = [
      { id: 'q1', completed: formData.q1 !== '' },
      { id: 'q2', completed: formData.q2.length > 0 },
      { id: 'q3', completed: formData.q3 !== '' },
      { id: 'q4', completed: formData.q4 !== '' },
      { id: 'q5', completed: formData.q5 !== '' },
      { id: 'q6', completed: formData.q6 !== '' },
      { id: 'q7', completed: formData.q7.length > 0 },
    ];
    requestAnimationFrame(() => focusFirstIncomplete(questions));
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算总进度（33题）
  const totalProgress = calculateTotalProgress(moduleProgress);

  const updateFormData = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 渲染单选选项卡片
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

  // 渲染多选选项卡片
  const renderMultiSelectCard = (
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
      <div className="flex items-center gap-4">
        <div className={cn('text-3xl', !isSelected && 'grayscale opacity-50')}>{emoji}</div>
        <div>
          <div className={cn('font-bold mb-1', isSelected && 'text-white')}>{title}</div>
          <div className={cn('text-sm opacity-80', isSelected ? 'text-white/90' : '')}>{description}</div>
        </div>
      </div>
    </button>
  );

  // 处理多选切换
  const toggleMultiSelect = (field: keyof FormData, value: string) => {
    setFormData((prev) => {
      const current = prev[field] as string[];
      const newValue = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: newValue };
    });
  };

  // 问题配置
  const questions = [
    {
      id: 1,
      key: 'q1' as keyof FormData,
      type: 'single',
      question: '1. 在亲密关系中，当你感到压力或与对方产生矛盾时，你通常会？',
      options: [
        { value: 'secure', emoji: '🤝', title: '安全型', desc: '我会主动沟通，坦诚说出自己的感受和需求，相信我们能共同解决。' },
        { value: 'anxious', emoji: '📡', title: '焦虑型', desc: '我会非常不安，反复试探或追问对方"还爱不爱我"，渴望立刻获得确认和安慰。' },
        { value: 'avoidant', emoji: '🏔️', title: '回避型', desc: '我会觉得喘不过气，本能地想要独处冷静，暂时"躲进洞穴"里，不愿意讨论这个问题。' },
      ],
    },
    {
      id: 2,
      key: 'q2' as keyof FormData,
      type: 'multi',
      question: '2. 当你感到被爱或被在乎时，以下哪种场景最让你心动？ (多选)',
      options: [
        { value: 'words', emoji: '🗣️', title: '肯定的言语', desc: '对方认真地夸赞我、发一段真诚的文字表达对我的欣赏。' },
        { value: 'time', emoji: '🧑‍🤝‍🧑', title: '精心的时刻', desc: '对方放下手机，专心陪我散步、聊天，或者一起完成一件小事。' },
        { value: 'gift', emoji: '🎁', title: '接受礼物', desc: '对方记得我随口说想要的小东西，或者在特殊日子准备了有意义的礼物。' },
        { value: 'service', emoji: '🫂', title: '服务的行动', desc: '对方在我疲惫时帮我分担琐事（比如取外卖、整理笔记），用行动替我分担压力。' },
        { value: 'touch', emoji: '🤗', title: '身体的接触', desc: '对方自然地拍拍我的头、牵手、拥抱，通过肢体接触传递温暖。' },
      ],
    },
    {
      id: 3,
      key: 'q3' as keyof FormData,
      type: 'single',
      question: '3. 在一段亲密关系中，你觉得"个人空间"对你来说意味着什么？',
      options: [
        { value: 'boundary', emoji: '🔒', title: '重要边界', desc: '我需要明确的独处时间和私人空间，这能让我保持自我和安全感。' },
        { value: 'merge', emoji: '🔗', title: '共享融合', desc: '我更喜欢两个人做什么都在一起，独处时反而容易感到孤单或胡思乱想。' },
        { value: 'balance', emoji: '⚖️', title: '动态平衡', desc: '看状态而定，状态好时可以各自独立，低落时会更依赖对方陪伴。' },
      ],
    },
    {
      id: 4,
      key: 'q4' as keyof FormData,
      type: 'single',
      question: '4. 当你感到情绪低落或疲惫时，你更希望伴侣怎么做？',
      options: [
        { value: 'listen', emoji: '🫂', title: '陪伴倾听', desc: '什么都不用说，安静地陪着我，听我倾诉就好。' },
        { value: 'analysis', emoji: '💡', title: '理性分析', desc: '帮我一起梳理问题，给出建议或解决方案，带我走出困境。' },
        { value: 'distract', emoji: '🎉', title: '转移注意力', desc: '带我出去走走、吃好吃的、看轻松的内容，让我暂时忘掉烦恼。' },
        { value: 'alone', emoji: '🚪', title: '尊重独处', desc: '给我空间自己消化，等我状态恢复后再聊。' },
      ],
    },
    {
      id: 5,
      key: 'q5' as keyof FormData,
      type: 'single',
      question: '5. 你觉得一段关系中，"安全感"主要来源于什么？',
      options: [
        { value: 'certainty', emoji: '✅', title: '确定性', desc: '对方的言行一致、承诺兑现、消息及时回复，让我感到可预测。' },
        { value: 'tolerance', emoji: '🔗', title: '包容度', desc: '即使我犯错或状态不好，对方依然接纳我，不会轻易离开。' },
        { value: 'social', emoji: '🌐', title: '社交融入', desc: '对方愿意把我介绍给朋友家人，让我进入ta的生活圈。' },
        { value: 'boundary', emoji: '🛡️', title: '边界清晰', desc: '对方能明确拒绝暧昧，不让我产生不必要的猜疑。' },
      ],
    },
    {
      id: 6,
      key: 'q6' as keyof FormData,
      type: 'single',
      question: '6. 在关系中，你更容易因为什么而感到"被消耗"？',
      options: [
        { value: 'communication', emoji: '🗣️', title: '无效沟通', desc: '反复争吵同样的问题，或对方总是回避沟通。' },
        { value: 'emotion', emoji: '📉', title: '情绪过载', desc: '需要不断承接对方的负面情绪，自己也被拖垮。' },
        { value: 'imbalance', emoji: '⚖️', title: '付出失衡', desc: '感觉总是自己在主动维系关系，对方回应冷淡。' },
        { value: 'compress', emoji: '🎭', title: '自我压缩', desc: '为了迁就对方，不得不压抑自己的需求和喜好。' },
      ],
    },
    {
      id: 7,
      key: 'q7' as keyof FormData,
      type: 'multi',
      question: '7. 你更希望亲密关系带给你的核心感受是？ (多选)',
      options: [
        { value: 'belonging', emoji: '🏠', title: '归属感', desc: '有一个随时可以回去的"港湾"，知道自己不是一个人。' },
        { value: 'growth', emoji: '🚀', title: '成长感', desc: '互相激励，成为更好的自己，共同探索更大的世界。' },
        { value: 'relax', emoji: '🎭', title: '松弛感', desc: '在彼此面前可以完全做自己，不用伪装，不用费力。' },
        { value: 'passion', emoji: '🔥', title: '激情感', desc: '保持心动、新鲜感和浪漫，不让关系变得平淡。' },
      ],
    },
  ];

  const handleModuleNavigate = (nextModuleId: number) => {
    // 检查目标模块之前的所有模块是否都已完成
    for (let m = 1; m < nextModuleId; m++) {
      const key = `module${m}` as keyof typeof MODULE_MAX_PROGRESS;
      if (moduleProgress[key] < MODULE_MAX_PROGRESS[key]) {
        navigate(`/questionnaire/${m}`);
        return;
      }
    }

    navigate(`/questionnaire/${nextModuleId}`);
  };

  const handleCompleteAndMatch = async () => {
    // 找到第一个未完成的题目
    const requiredQuestions = [
      { id: 'q1', completed: formData.q1 !== '' },
      { id: 'q2', completed: formData.q2.length > 0 },
      { id: 'q3', completed: formData.q3 !== '' },
      { id: 'q4', completed: formData.q4 !== '' },
      { id: 'q5', completed: formData.q5 !== '' },
      { id: 'q6', completed: formData.q6 !== '' },
      { id: 'q7', completed: formData.q7.length > 0 },
    ];

    if (focusFirstIncomplete(requiredQuestions)) {
      return;
    }

    const saved = await persistNow(formData);
    if (!saved) {
      alert('提交前保存失败，请稍后重试');
      return;
    }

    await joinMatching();
    navigate('/waiting');
  };

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
          <h1 className="text-4xl font-black tracking-tight text-on-surface">亲密关系说明书</h1>
          <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
            每个人都是一本待翻阅的书，依恋是序章，爱是语言，冲突是章节里的起伏。写下你的"说明书"，不是为了被定义，而是为了让那个读懂你的人，一翻开就知道如何爱你。
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
                    {q.type === 'single' ? (
                      renderOptionCard(
                        opt.emoji,
                        opt.title,
                        opt.desc,
                        formData[q.key as keyof FormData] === opt.value,
                        () => updateFormData(q.key as keyof FormData, formData[q.key as keyof FormData] === opt.value ? '' : opt.value)
                      )
                    ) : (
                      renderMultiSelectCard(
                        opt.emoji,
                        opt.title,
                        opt.desc,
                        (formData[q.key as keyof FormData] as string[]).includes(opt.value),
                        () => toggleMultiSelect(q.key as keyof FormData, opt.value)
                      )
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
            onClick={handleCompleteAndMatch}
            className="w-full py-5 rounded-full bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white font-black tracking-widest text-lg shadow-xl shadow-[#F28C38]/30 active:scale-95 transition-all"
          >
            完成并参与本周匹配
          </button>
        </div>
      </section>
    </main>
  );
};

export default QuestionnaireModule5;
