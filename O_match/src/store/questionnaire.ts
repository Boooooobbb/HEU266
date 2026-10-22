import { create } from 'zustand';
import type { ModuleProgress } from '@/utils/questionnaireProgress';

const createEmptyModuleProgress = (): ModuleProgress => ({
  module1: 0,
  module2: 0,
  module3: 0,
  module4: 0,
  module5: 0,
});

interface QuestionnaireState {
  currentModule: number;
  // 存储每个模块的完成状态
  moduleProgress: ModuleProgress;
  isSubmitting: boolean;

  setCurrentModule: (module: number) => void;
  setModuleProgress: (module: number, progress: number) => void;
  setModuleProgressSnapshot: (progress: ModuleProgress) => void;
  setIsSubmitting: (submitting: boolean) => void;
  resetQuestionnaire: () => void;
}

export const useQuestionnaireStore = create<QuestionnaireState>((set) => ({
  currentModule: 1,
  moduleProgress: createEmptyModuleProgress(),
  isSubmitting: false,

  setCurrentModule: (module) => set({ currentModule: module }),
  setModuleProgress: (module, progress) =>
    set((state) => ({
      moduleProgress: {
        ...state.moduleProgress,
        [`module${module}`]: progress,
      },
    })),
  setModuleProgressSnapshot: (moduleProgress) =>
    set({ moduleProgress: { ...moduleProgress } }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  resetQuestionnaire: () =>
    set({
      currentModule: 1,
      moduleProgress: createEmptyModuleProgress(),
      isSubmitting: false,
    }),
}));
