import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/utils';
import { useQuestionnaireStore } from '@/store';
import { useQuestionnaireAutoSave } from '@/hooks/useQuestionnaireAutoSave';
import { useIncompleteQuestionPrompt } from '@/hooks/useIncompleteQuestionPrompt';
import { QuestionnaireTopProgress } from '@/components/common/QuestionnaireTopProgress';
import { calculateModule1Progress, calculateTotalProgress } from '@/utils/questionnaireProgress';

const modules = [
  { id: 1, name: '基础画像', icon: 'person', path: '/questionnaire/1' },
  { id: 2, name: '生活颗粒度', icon: 'bedtime', path: '/questionnaire/2' },
  { id: 3, name: '性格调色盘', icon: 'psychology', path: '/questionnaire/3' },
  { id: 4, name: '三观与旷野', icon: 'favorite', path: '/questionnaire/4' },
  { id: 5, name: '亲密关系说明书', icon: 'diversity_1', path: '/questionnaire/5' },
];

const locations = [
  '启航活动中心', '图书馆', '船海楼', '11号楼', '21号楼',
  '31号楼', '41号楼', '61号楼', '南体', '北体', '军工操场', '体育馆', '宿舍', '各大食堂'
];

const QuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const currentModule = moduleId ? parseInt(moduleId) : 1;
  const { moduleProgress, setModuleProgress } = useQuestionnaireStore();

  const {
    formData,
    setFormData,
    saveState,
    lastSavedAt,
    isHydrated,
    persistNow,
  } = useQuestionnaireAutoSave({
    moduleKey: 'module1',
    initialData: {
      gender: '',
      expectedGender: '',
      stage: '',
      partnerStages: [] as string[],
      locations: [] as string[],
    },
  });

  const { incompleteHintId, focusFirstIncomplete } = useIncompleteQuestionPrompt();

  // 计算当前模块已完成题目数
  const currentModuleProgress = calculateModule1Progress(formData);

  // 将当前模块进度存入 store
  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setModuleProgress(1, currentModuleProgress);
  }, [currentModuleProgress, isHydrated, setModuleProgress]);

  // 首次加载时自动滚动到第一个未完成的题目
  const hasScrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const questions = [
      { id: 'q1', completed: formData.gender !== '' },
      { id: 'q2', completed: formData.expectedGender !== '' },
      { id: 'q3', completed: formData.stage !== '' },
      { id: 'q4', completed: formData.partnerStages.length > 0 },
      { id: 'q5', completed: formData.locations.length > 0 },
    ];
    // 延迟一帧确保 DOM 渲染完成
    requestAnimationFrame(() => focusFirstIncomplete(questions));
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算总进度（33题）
  const totalProgress = calculateTotalProgress(moduleProgress);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePartnerStageToggle = (stage: string) => {
    setFormData((prev) => {
      if (stage === 'both') {
        // 如果已经选中 'both'，则取消选择
        if (prev.partnerStages.includes('both')) {
          return { ...prev, partnerStages: [] };
        }
        return { ...prev, partnerStages: ['both'] };
      }
      // 处理其他阶段选项
      const newStages = prev.partnerStages.includes(stage)
        ? prev.partnerStages.filter((s) => s !== stage)
        : [...prev.partnerStages.filter((s) => s !== 'both'), stage];

      // 如果选中了所有4个阶段选项，自动选中"都可以"
      if (newStages.length === 4) {
        return { ...prev, partnerStages: ['both'] };
      }

      return { ...prev, partnerStages: newStages };
    });
  };

  const handleLocationToggle = (location: string) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter((l) => l !== location)
        : [...prev.locations, location],
    }));
  };

  const nextModule = async () => {
    // 找到第一个未完成的题目
    const questions = [
      { id: 'q1', completed: formData.gender !== '' },
      { id: 'q2', completed: formData.expectedGender !== '' },
      { id: 'q3', completed: formData.stage !== '' },
      { id: 'q4', completed: formData.partnerStages.length > 0 },
      { id: 'q5', completed: formData.locations.length > 0 },
    ];

    if (focusFirstIncomplete(questions)) {
      return;
    }

    // 所有题目已完成，继续下一个模块
    if (currentModule < 5) {
      await persistNow(formData);
      navigate(`/questionnaire/${currentModule + 1}`);
    }
  };

  const handleModuleNavigate = (nextModuleId: number) => {
    if (nextModuleId > currentModule) {
      const questions = [
        { id: 'q1', completed: formData.gender !== '' },
        { id: 'q2', completed: formData.expectedGender !== '' },
        { id: 'q3', completed: formData.stage !== '' },
        { id: 'q4', completed: formData.partnerStages.length > 0 },
        { id: 'q5', completed: formData.locations.length > 0 },
      ];

      if (focusFirstIncomplete(questions)) {
        return;
      }
    }

    navigate(`/questionnaire/${nextModuleId}`);
  };

  const getModuleTitle = () => {
    const module = modules.find((m) => m.id === currentModule);
    return module?.name || '基础画像';
  };

  return (
    <main className="pt-12 pb-44 px-4 max-w-3xl mx-auto min-h-screen">
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
          <h1 className="text-4xl font-black tracking-tight text-on-surface">{getModuleTitle()}</h1>
          <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
            欢迎开启你的灵魂盲盒。这几个基础问题将作为我们为你匹配的『物理坐标』，仅需 <span className="text-secondary font-bold">30 秒</span> 即可完成。
          </p>
        </div>

        {/* Q1: 性别 */}
        <div id="q1" className="space-y-4 relative">
          {incompleteHintId === 'q1' && (
            <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              请完成此题
            </div>
          )}
          <label className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
            你的性别是？
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={cn(
                'relative p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.gender === 'male' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('gender', formData.gender === 'male' ? '' : 'male')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">man</span>
              <span className="font-bold text-sm">男生</span>
            </div>
            <div
              className={cn(
                'relative p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.gender === 'female' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('gender', formData.gender === 'female' ? '' : 'female')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">woman</span>
              <span className="font-bold text-sm">女生</span>
            </div>
          </div>
        </div>

        {/* Q2: 期待 */}
        <div id="q2" className="space-y-4 relative">
          {incompleteHintId === 'q2' && (
            <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              请完成此题
            </div>
          )}
          <label className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
            期待相遇的灵魂是？
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.expectedGender === 'male' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('expectedGender', formData.expectedGender === 'male' ? '' : 'male')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">man</span>
              <span className="font-bold text-sm text-on-surface">男生</span>
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.expectedGender === 'female' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('expectedGender', formData.expectedGender === 'female' ? '' : 'female')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">woman</span>
              <span className="font-bold text-sm text-on-surface">女生</span>
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer md:col-span-1',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.expectedGender === 'both' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('expectedGender', formData.expectedGender === 'both' ? '' : 'both')}
            >
                <span className="material-symbols-outlined text-3xl text-stone-400">auto_awesome</span>
                <span className="font-bold text-sm text-on-surface text-center">都可以，灵魂契合最重要</span>
              </div>
          </div>
        </div>

        {/* Q3: 修炼阶段 */}
        <div id="q3" className="space-y-4 relative">
          {incompleteHintId === 'q3' && (
            <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              请完成此题
            </div>
          )}
          <label className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
            你目前的"修炼"阶段是？
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.stage === 'undergrad_low' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('stage', formData.stage === 'undergrad_low' ? '' : 'undergrad_low')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">school</span>
              <span className="font-bold text-sm text-on-surface text-center">
                本科低年级<br/>
                <span className="text-[10px] font-medium opacity-60">（大一、大二）</span>
              </span>
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.stage === 'undergrad_high' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('stage', formData.stage === 'undergrad_high' ? '' : 'undergrad_high')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">history_edu</span>
              <span className="font-bold text-sm text-on-surface text-center">
                本科高年级<br/>
                <span className="text-[10px] font-medium opacity-60">（大三、大四）</span>
              </span>
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.stage === 'master' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('stage', formData.stage === 'master' ? '' : 'master')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">workspace_premium</span>
              <span className="font-bold text-sm text-on-surface">硕士研究生</span>
            </div>
            <div
              className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent cursor-pointer',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]',
                formData.stage === 'doctor' && 'border-primary bg-white'
              )}
              onClick={() => updateFormData('stage', formData.stage === 'doctor' ? '' : 'doctor')}
            >
              <span className="material-symbols-outlined text-3xl text-stone-400">military_tech</span>
              <span className="font-bold text-sm text-on-surface">博士研究生</span>
            </div>
          </div>
        </div>

        {/* Q4: 对方阶段 */}
        <div id="q4" className="space-y-4 relative">
          {incompleteHintId === 'q4' && (
            <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              请完成此题
            </div>
          )}
          <label className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
            期待对方处于什么阶段？ （可多选）
          </label>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <label className="relative group cursor-pointer">
              <input
                className="peer sr-only"
                name="partnerStage"
                type="checkbox"
                checked={formData.partnerStages.includes('undergrad_low')}
                onChange={() => handlePartnerStageToggle('undergrad_low')}
              />
              <div className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent',
                'peer-checked:border-primary peer-checked:bg-white',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
              )}>
                <span className="material-symbols-outlined text-3xl text-stone-400 group-hover:text-primary transition-colors">school</span>
                <span className="font-bold text-sm text-on-surface">
                  本科低年级<br/>
                  <span className="text-[10px] font-medium opacity-60">（大一、大二）</span>
                </span>
              </div>
            </label>
            <label className="relative group cursor-pointer">
              <input
                className="peer sr-only"
                name="partnerStage"
                type="checkbox"
                checked={formData.partnerStages.includes('undergrad_high')}
                onChange={() => handlePartnerStageToggle('undergrad_high')}
              />
              <div className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent',
                'peer-checked:border-primary peer-checked:bg-white',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
              )}>
                <span className="material-symbols-outlined text-3xl text-stone-400 group-hover:text-primary transition-colors">history_edu</span>
                <span className="font-bold text-sm text-on-surface">
                  本科高年级<br/>
                  <span className="text-[10px] font-medium opacity-60">（大三、大四）</span>
                </span>
              </div>
            </label>
            <label className="relative group cursor-pointer">
              <input
                className="peer sr-only"
                name="partnerStage"
                type="checkbox"
                checked={formData.partnerStages.includes('master')}
                onChange={() => handlePartnerStageToggle('master')}
              />
              <div className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent',
                'peer-checked:border-primary peer-checked:bg-white',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
              )}>
                <span className="material-symbols-outlined text-3xl text-stone-400 group-hover:text-primary transition-colors">workspace_premium</span>
                <span className="font-bold text-sm text-on-surface">硕士研究生</span>
              </div>
            </label>
            <label className="relative group cursor-pointer">
              <input
                className="peer sr-only"
                name="partnerStage"
                type="checkbox"
                checked={formData.partnerStages.includes('doctor')}
                onChange={() => handlePartnerStageToggle('doctor')}
              />
              <div className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-transparent',
                'peer-checked:border-primary peer-checked:bg-white',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
              )}>
                <span className="material-symbols-outlined text-3xl text-stone-400 group-hover:text-primary transition-colors">military_tech</span>
                <span className="font-bold text-sm text-on-surface">博士研究生</span>
              </div>
            </label>
            <label className="relative group cursor-pointer col-span-2">
              <input
                className="peer sr-only"
                name="partnerStage"
                type="checkbox"
                checked={formData.partnerStages.includes('both')}
                onChange={() => handlePartnerStageToggle('both')}
              />
              <div className={cn(
                'p-6 rounded-2xl bg-surface-container-low border-2 border-dashed border-secondary/20',
                'peer-checked:border-secondary peer-checked:border-solid peer-checked:bg-white',
                'transition-all duration-300 flex flex-col items-center gap-3',
                'shadow-[0_8px_32px_0_rgba(28,28,24,0.06)]'
              )}>
                <span className="material-symbols-outlined text-3xl text-stone-400 group-hover:text-secondary transition-colors">all_inclusive</span>
                <span className="font-bold text-sm text-secondary">都可以</span>
              </div>
            </label>
          </div>
        </div>

        {/* Q5: 刷新地 */}
        <div id="q5" className="space-y-4 relative">
          {incompleteHintId === 'q5' && (
            <div className="absolute -right-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded-lg">
              请完成此题
            </div>
          )}
          <label className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-container rounded-full"></span>
            你在 HEU 的主要刷新地是？
          </label>
          <div className="flex flex-wrap gap-2">
            {locations.map((location) => (
              <label key={location} className="relative cursor-pointer group">
                <input
                  className="peer sr-only"
                  name="locations"
                  type="checkbox"
                  checked={formData.locations.includes(location)}
                  onChange={() => handleLocationToggle(location)}
                />
                <div className={cn(
                  'px-5 py-2.5 rounded-full bg-surface-container-high text-on-surface-variant',
                  'font-bold text-sm transition-all active:scale-95',
                  'peer-checked:bg-gradient-to-br peer-checked:from-[#F28C38] peer-checked:to-[#F68A2F]',
                  'peer-checked:text-white peer-checked:shadow-xl peer-checked:shadow-orange-900/20',
                  'hover:bg-orange-50 hover:text-primary'
                )}>
                  {location}
                </div>
              </label>
            ))}
          </div>
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

export default QuestionnairePage;