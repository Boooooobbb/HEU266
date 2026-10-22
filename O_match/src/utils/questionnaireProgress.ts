import type { QuestionnaireAnswer } from '@/services/questionnaireService';

export interface ModuleProgress {
  module1: number;
  module2: number;
  module3: number;
  module4: number;
  module5: number;
}

export const QUESTIONNAIRE_TOTAL_QUESTIONS = 33;

/**
 * 判断问卷答案在运行时是否真的已填写。
 *
 * Supabase 或旧版本缓存可能返回 null/undefined；不能只用 `value !== ''`
 * 判断，否则界面没有选中任何选项时仍会被当作已完成。
 */
export const isQuestionnaireAnswerComplete = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === 'string' && value.trim().length > 0;
};

export const calculateModule1Progress = (
  module1: QuestionnaireAnswer['module1'] | null | undefined
): number => {
  return [
    module1?.gender,
    module1?.expectedGender,
    module1?.stage,
    module1?.partnerStages,
    module1?.locations,
  ].filter(isQuestionnaireAnswerComplete).length;
};

export const calculateModule2Progress = (
  module2: QuestionnaireAnswer['module2'] | null | undefined
): number => {
  return [
    isQuestionnaireAnswerComplete(module2?.q1Schedule) && isQuestionnaireAnswerComplete(module2?.q1Attitude),
    isQuestionnaireAnswerComplete(module2?.q2Space) && isQuestionnaireAnswerComplete(module2?.q2Tolerance),
    isQuestionnaireAnswerComplete(module2?.q3Frequency) && isQuestionnaireAnswerComplete(module2?.q3Bottomline),
    isQuestionnaireAnswerComplete(module2?.q4Smoking) && isQuestionnaireAnswerComplete(module2?.q4Bottomline),
    isQuestionnaireAnswerComplete(module2?.q5Alcohol) && isQuestionnaireAnswerComplete(module2?.q5Bottomline),
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
  ].filter(isQuestionnaireAnswerComplete).length;
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
  ].filter(isQuestionnaireAnswerComplete).length;
};

export const calculateModule5Progress = (
  module5: QuestionnaireAnswer['module5'] | null | undefined
): number => {
  return [
    module5?.q1,
    module5?.q2,
    module5?.q3,
    module5?.q4,
    module5?.q5,
    module5?.q6,
    module5?.q7,
  ].filter(isQuestionnaireAnswerComplete).length;
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
