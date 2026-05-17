import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils';
import { useQuestionnaireStore } from '@/store';
import { useQuestionnaireAutoSave } from '@/hooks/useQuestionnaireAutoSave';
import { useIncompleteQuestionPrompt } from '@/hooks/useIncompleteQuestionPrompt';
import { QuestionnaireTopProgress } from '@/components/common/QuestionnaireTopProgress';
import { calculateModule2Progress, calculateTotalProgress, MODULE_MAX_PROGRESS } from '@/utils/questionnaireProgress';

const modules = [
  { id: 1, name: '基础画像', icon: 'person', path: '/questionnaire/1' },
  { id: 2, name: '生活颗粒度', icon: 'bedtime', path: '/questionnaire/2' },
  { id: 3, name: '性格调色盘', icon: 'psychology', path: '/questionnaire/3' },
  { id: 4, name: '三观与旷野', icon: 'favorite', path: '/questionnaire/4' },
  { id: 5, name: '亲密关系说明书', icon: 'diversity_1', path: '/questionnaire/5' },
];

interface FormData {
  q1Schedule: string;
  q1Attitude: string;
  q2Space: string;
  q2Tolerance: string;
  q3Frequency: string;
  q3Bottomline: string;
  q4Smoking: string;
  q4Bottomline: string;
  q5Alcohol: string;
  q5Bottomline: string;
}

const QuestionnaireModule2: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const currentModule = moduleId ? parseInt(moduleId) : 2;
  const { moduleProgress, setModuleProgress } = useQuestionnaireStore();

  const {
    formData,
    setFormData,
    saveState,
    lastSavedAt,
    isHydrated,
    persistNow,
  } = useQuestionnaireAutoSave<FormData>({
    moduleKey: 'module2',
    initialData: {
      q1Schedule: '',
      q1Attitude: '',
      q2Space: '',
      q2Tolerance: '',
      q3Frequency: '',
      q3Bottomline: '',
      q4Smoking: '',
      q4Bottomline: '',
      q5Alcohol: '',
      q5Bottomline: '',
    },
  });

  const { incompleteHintId, focusFirstIncomplete } = useIncompleteQuestionPrompt();

  // 计算当前模块已完成题目数
  const currentModuleProgress = calculateModule2Progress(formData);

  // 将当前模块进度存入 store
  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setModuleProgress(2, currentModuleProgress);
  }, [currentModuleProgress, isHydrated, setModuleProgress]);

  // 首次加载时自动滚动到第一个未完成的题目
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const questions = [
      { id: 'q1', completed: formData.q1Schedule !== '' && formData.q1Attitude !== '' },
      { id: 'q2', completed: formData.q2Space !== '' && formData.q2Tolerance !== '' },
      { id: 'q3', completed: formData.q3Frequency !== '' && formData.q3Bottomline !== '' },
      { id: 'q4', completed: formData.q4Smoking !== '' && formData.q4Bottomline !== '' },
      { id: 'q5', completed: formData.q5Alcohol !== '' && formData.q5Bottomline !== '' },
    ];
    requestAnimationFrame(() => focusFirstIncomplete(questions));
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算总进度（34题）
  const totalProgress = calculateTotalProgress(moduleProgress);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextModule = async () => {
    // 找到第一个未完成的题目（每个大题需要两个子问题都完成）
    const questions = [
      { id: 'q1', completed: formData.q1Schedule !== '' && formData.q1Attitude !== '' },
      { id: 'q2', completed: formData.q2Space !== '' && formData.q2Tolerance !== '' },
      { id: 'q3', completed: formData.q3Frequency !== '' && formData.q3Bottomline !== '' },
      { id: 'q4', completed: formData.q4Smoking !== '' && formData.q4Bottomline !== '' },
      { id: 'q5', completed: formData.q5Alcohol !== '' && formData.q5Bottomline !== '' },
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
        { id: 'q1', completed: formData.q1Schedule !== '' && formData.q1Attitude !== '' },
        { id: 'q2', completed: formData.q2Space !== '' && formData.q2Tolerance !== '' },
        { id: 'q3', completed: formData.q3Frequency !== '' && formData.q3Bottomline !== '' },
        { id: 'q4', completed: formData.q4Smoking !== '' && formData.q4Bottomline !== '' },
        { id: 'q5', completed: formData.q5Alcohol !== '' && formData.q5Bottomline !== '' },
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

  // 渲染选项卡片 - 与HTML完全一致
  const renderOptionCard = (
    icon: string,
    label: string,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      className={cn(
        'group p-6 rounded-2xl transition-all duration-300 text-left',
        isSelected
          ? 'bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white shadow-lg shadow-[#F28C38]/30'
          : 'bg-stone-50/80 text-[#554337] shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
      )}
    >
      <div className={cn('text-3xl mb-3', !isSelected && 'grayscale opacity-50')}>{icon}</div>
      <div className={cn('font-bold', isSelected ? 'text-white' : '')}>{label}</div>
    </button>
  );

  // 渲染小选项按钮 - 与HTML完全一致
  const renderSmallOption = (label: string, isSelected: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-3 rounded-xl text-center text-sm font-medium bg-white/60 text-[#554337] shadow-sm hover:bg-white transition-all w-full',
        isSelected && 'bg-gradient-to-br from-[#F28C38] to-[#f68a2f] text-white shadow-lg shadow-[#F28C38]/30 font-bold'
      )}
    >
      {label}
    </button>
  );

  // 渲染二级问题
  const renderSubQuestion = (
    question: string,
    options: { value: string; label: string }[],
    field: keyof FormData,
    iconType: 'warning' | 'heart_broken' | 'do_not_disturb_on' | 'shield' = 'warning'
  ) => (
    <div className="p-6 rounded-3xl bg-secondary-fixed/20 space-y-4 border border-secondary-fixed/30">
      <div className="flex items-center gap-2 text-on-secondary-fixed-variant font-bold">
        <span className="material-symbols-outlined text-lg">
          {iconType === 'warning' && 'warning'}
          {iconType === 'heart_broken' && 'heart_broken'}
          {iconType === 'do_not_disturb_on' && 'do_not_disturb_on'}
          {iconType === 'shield' && 'shield'}
        </span>
        {question}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {options.map((opt) => (
          <React.Fragment key={opt.value}>
            {renderSmallOption(opt.label, formData[field] === opt.value, () => updateFormData(field, formData[field] === opt.value ? '' : opt.value))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

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
          <h1 className="text-4xl font-black tracking-tight text-on-surface">生活颗粒度</h1>
          <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
            灵魂再契合，也需要生活在同一个物理时空。告诉我们你的生活节奏，我们会帮你避开那些『水火不容』的雷区。
          </p>
        </div>

        {/* Question Blocks */}
        <div className="space-y-16">
          {/* Q1: 作息结界 */}
          <section id="q1" className="space-y-6 relative">
            {incompleteHintId === 'q1' && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            <label className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
              1. 作息结界：你的日常生物钟是怎样的？
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderOptionCard('🌅', '早起自律派', formData.q1Schedule === 'early', () => updateFormData('q1Schedule', formData.q1Schedule === 'early' ? '' : 'early'))}
              {renderOptionCard('⚖️', '弹性凡人派', formData.q1Schedule === 'flexible', () => updateFormData('q1Schedule', formData.q1Schedule === 'flexible' ? '' : 'flexible'))}
              {renderOptionCard('🦉', '深夜灵感派', formData.q1Schedule === 'night', () => updateFormData('q1Schedule', formData.q1Schedule === 'night' ? '' : 'night'))}
            </div>
            {renderSubQuestion(
              '对于对方的作息，你的态度是？',
              [
                { value: 'A', label: 'A. 必须和我同频 💣' },
                { value: 'B', label: 'B. 最好相似，但我能包容 💛' },
                { value: 'C', label: 'C. 无所谓，互不打扰就行 ⭕' },
              ],
              'q1Attitude',
              'warning'
            )}
          </section>

          {/* Q2: 空间信仰 */}
          <section id="q2" className="space-y-6 relative">
            {incompleteHintId === 'q2' && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            <label className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
              2. 空间信仰：对于个人空间的整洁度？
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderOptionCard('✨', '极度整洁', formData.q2Space === 'neat', () => updateFormData('q2Space', formData.q2Space === 'neat' ? '' : 'neat'))}
              {renderOptionCard('📦', '乱中有序', formData.q2Space === 'chaotic', () => updateFormData('q2Space', formData.q2Space === 'chaotic' ? '' : 'chaotic'))}
              {renderOptionCard('🌪️', '随性洒脱', formData.q2Space === 'casual', () => updateFormData('q2Space', formData.q2Space === 'casual' ? '' : 'casual'))}
            </div>
            {renderSubQuestion(
              '如果对方的卫生习惯和你差异极大，你能接受吗？',
              [
                { value: 'A', label: 'A. 绝对不能接受 💣' },
                { value: 'B', label: 'B. 稍微有点介意 💛' },
                { value: 'C', label: 'C. 完全不介意 ⭕' },
              ],
              'q2Tolerance',
              'warning'
            )}
          </section>

          {/* Q3: 消息频率 */}
          <section id="q3" className="space-y-6 relative">
            {incompleteHintId === 'q3' && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            <label className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
              3. 消息频率：你期望日常的微信沟通节奏是？
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderOptionCard('📱', '高频互动', formData.q3Frequency === 'high', () => updateFormData('q3Frequency', formData.q3Frequency === 'high' ? '' : 'high'))}
              {renderOptionCard('⏳', '正常报备', formData.q3Frequency === 'normal', () => updateFormData('q3Frequency', formData.q3Frequency === 'normal' ? '' : 'normal'))}
              {renderOptionCard('📴', '意念回复', formData.q3Frequency === 'low', () => updateFormData('q3Frequency', formData.q3Frequency === 'low' ? '' : 'low'))}
            </div>
            {renderSubQuestion(
              '对于对方的回消息速度，你的底线是？',
              [
                { value: 'A', label: 'A. 无法接受"意念回复" 💣' },
                { value: 'B', label: 'B. 无法接受"高频互动" 💣' },
                { value: 'C', label: 'C. 顺其自然 ⭕' },
              ],
              'q3Bottomline',
              'heart_broken'
            )}
          </section>

          {/* Q4: 烟草偏好 */}
          <section id="q4" className="space-y-6 relative">
            {incompleteHintId === 'q4' && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            <label className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
              4. 烟草偏好：关于抽烟，你的真实状态是？
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderOptionCard('🚭', '坚决不抽', formData.q4Smoking === 'never', () => updateFormData('q4Smoking', formData.q4Smoking === 'never' ? '' : 'never'))}
              {renderOptionCard('💨', '偶尔/社交抽', formData.q4Smoking === 'sometimes', () => updateFormData('q4Smoking', formData.q4Smoking === 'sometimes' ? '' : 'sometimes'))}
              {renderOptionCard('🚬', '习惯性抽烟', formData.q4Smoking === 'often', () => updateFormData('q4Smoking', formData.q4Smoking === 'often' ? '' : 'often'))}
            </div>
            {renderSubQuestion(
              '对于另一半的抽烟习惯，你的底线要求是？',
              [
                { value: 'A', label: 'A. 绝对红线 💣' },
                { value: 'B', label: 'B. 有条件接受 💛' },
                { value: 'C', label: 'C. 完全不介意 ⭕' },
              ],
              'q4Bottomline',
              'do_not_disturb_on'
            )}
          </section>

          {/* Q5: 酒精偏好 */}
          <section id="q5" className="space-y-6 relative">
            {incompleteHintId === 'q5' && (
              <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
                请完成此题
              </div>
            )}
            <label className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
              5. 酒精偏好：关于喝酒，你的真实状态是？
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderOptionCard('🚫', '滴酒不沾', formData.q5Alcohol === 'never', () => updateFormData('q5Alcohol', formData.q5Alcohol === 'never' ? '' : 'never'))}
              {renderOptionCard('🥂', '偶尔微醺', formData.q5Alcohol === 'sometimes', () => updateFormData('q5Alcohol', formData.q5Alcohol === 'sometimes' ? '' : 'sometimes'))}
              {renderOptionCard('🍻', '无酒不欢', formData.q5Alcohol === 'often', () => updateFormData('q5Alcohol', formData.q5Alcohol === 'often' ? '' : 'often'))}
            </div>
            {renderSubQuestion(
              '对于另一半的饮酒习惯，你的底线要求是？',
              [
                { value: 'A', label: 'A. 绝对红线 💣' },
                { value: 'B', label: 'B. 有条件接受 💛' },
                { value: 'C', label: 'C. 完全不介意 ⭕️' },
              ],
              'q5Bottomline',
              'shield'
            )}
          </section>
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

export default QuestionnaireModule2;