import { create } from 'zustand';

interface QuestionnaireState {
  currentModule: number;
  // 存储每个模块的完成状态
  moduleProgress: {
    module1: number; // 0-6
    module2: number; // 0-5
    module3: number; // 0-10
    module4: number; // 0-6
    module5: number; // 0-7
  };
  isSubmitting: boolean;

  setCurrentModule: (module: number) => void;
  setModuleProgress: (module: number, progress: number) => void;
  setIsSubmitting: (submitting: boolean) => void;
  resetQuestionnaire: () => void;
}

export const useQuestionnaireStore = create<QuestionnaireState>((set) => ({
  currentModule: 1,
  moduleProgress: {
    module1: 0,
    module2: 0,
    module3: 0,
    module4: 0,
    module5: 0,
  },
  isSubmitting: false,

  setCurrentModule: (module) => set({ currentModule: module }),
  setModuleProgress: (module, progress) =>
    set((state) => ({
      moduleProgress: {
        ...state.moduleProgress,
        [`module${module}`]: progress,
      },
    })),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  resetQuestionnaire: () =>
    set({
      currentModule: 1,
      moduleProgress: {
        module1: 0,
        module2: 0,
        module3: 0,
        module4: 0,
        module5: 0,
      },
      isSubmitting: false,
    }),
}));