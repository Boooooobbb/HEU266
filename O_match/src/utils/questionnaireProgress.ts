import type { QuestionnaireAnswer } from '@/services/questionnaireService';

export interface ModuleProgress {
  module1: number;
  module2: number;
  module3: number;
  module4: number;
  module5: number;
}

export const QUESTIONNAIRE_TOTAL_QUESTIONS = 34;

export const MODULE_MAX_PROGRESS = {
  module1: 6,
  module2: 5,
  module3: 10,
  module4: 6,
  module5: 7,
} as const;

export const resolveQuestionnaireModulePath = (
  data: QuestionnaireAnswer | null | undefined
): string => {
  if (!data) return '/questionnaire/1';

  const progress = calculateModuleProgress(data);
  if (progress.module1 < MODULE_MAX_PROGRESS.module1) return '/questionnaire/1';
  if (progress.module2 < MODULE_MAX_PROGRESS.module2) return '/questionnaire/2';
  if (progress.module3 < MODULE_MAX_PROGRESS.module3) return '/questionnaire/3';
  if (progress.module4 < MODULE_MAX_PROGRESS.module4) return '/questionnaire/4';
  if (progress.module5 < MODULE_MAX_PROGRESS.module5) return '/questionnaire/5';

  return '/waiting';
};

export const calculateModule1Progress = (
  module1: QuestionnaireAnswer['module1'] | null | undefined
): number => {
  return [
    module1?.gender,
    module1?.expectedGender,
    module1?.stage,
    module1?.partnerStages?.length ? 'done' : '',
    module1?.locations?.length ? 'done' : '',
    module1?.interests?.length ? 'done' : '',
  ].filter(Boolean).length;
};

export const calculateModule2Progress = (
  module2: QuestionnaireAnswer['module2'] | null | undefined
): number => {
  return [
    module2?.q1Schedule && module2?.q1Attitude,
    module2?.q2Space && module2?.q2Tolerance,
    module2?.q3Frequency && module2?.q3Bottomline,
    module2?.q4Smoking && module2?.q4Bottomline,
    module2?.q5Alcohol && module2?.q5Bottomline,
  ].filter(Boolean).length;
};

export const calculateModule3Progress = (
  module3: QuestionnaireAnswer['module3'] | null | undefined
): number => {
  return [
    module3?.q1Preference,
    module3?.q2Preference,
    module3?.q3Preference,
    module3?.q4Preference,
    module3?.q5Preference,
    module3?.q6Preference,
    module3?.q7Preference,
    module3?.q8Preference,
    module3?.q9Preference,
    module3?.q10Preference,
  ].filter(Boolean).length;
};

export const calculateModule4Progress = (
  module4: QuestionnaireAnswer['module4'] | null | undefined
): number => {
  return [
    module4?.q1,
    module4?.q2,
    module4?.q3,
    module4?.q4,
    module4?.q5,
    module4?.q6,
  ].filter(Boolean).length;
};

export const calculateModule5Progress = (
  module5: QuestionnaireAnswer['module5'] | null | undefined
): number => {
  return [
    module5?.q1,
    module5?.q2?.length ? 'done' : '',
    module5?.q3,
    module5?.q4,
    module5?.q5,
    module5?.q6,
    module5?.q7?.length ? 'done' : '',
  ].filter(Boolean).length;
};

export const calculateModuleProgress = (
  data: QuestionnaireAnswer | null | undefined
): ModuleProgress => {
  const module1 = calculateModule1Progress(data?.module1);
  const module2 = calculateModule2Progress(data?.module2);
  const module3 = calculateModule3Progress(data?.module3);
  const module4 = calculateModule4Progress(data?.module4);
  const module5 = calculateModule5Progress(data?.module5);

  return { module1, module2, module3, module4, module5 };
};

export const calculateTotalProgress = (moduleProgress: ModuleProgress): number => {
  return moduleProgress.module1 + moduleProgress.module2 + moduleProgress.module3 + moduleProgress.module4 + moduleProgress.module5;
};
