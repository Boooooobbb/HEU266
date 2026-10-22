/**
 * 问卷数据服务层
 *
 * 目前使用 localStorage 实现数据持久化
 * 后续对接真实后端时，只需替换以下方法即可：
 * 1. 将 localStorage 替换为 API 调用
 * 2. 保持相同的函数签名和返回格式
 *
 * 后端 API 设计参考：
 * POST /api/questionnaire/save    - 保存问卷
 * GET  /api/questionnaire/load    - 加载问卷
 * DELETE /api/questionnaire/clear - 清除保存的问卷
 */

import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { QUESTIONNAIRE_TOTAL_QUESTIONS } from '@/utils/questionnaireProgress';

const STORAGE_KEY_PREFIX = 'stitch_o_match_questionnaire';
const LEGACY_STORAGE_KEY = 'stitch_o_match_questionnaire';
const USER_STORAGE_KEY = 'stitch_o_match_user';
let questionnaireCache: QuestionnaireAnswer | null = null;
let questionnaireCacheKey: string | null = null;
const REMOTE_SYNC_TTL_MS = 15 * 1000;

let lastRemoteSyncAt = 0;
let remoteCacheUserId: string | null = null;
let remoteLoadPromise: Promise<QuestionnaireAnswer | null> | null = null;

const MODULE_ROW_CONFIG = {
  module1: { moduleId: 'module_1' },
  module2: { moduleId: 'module_2' },
  module3: { moduleId: 'module_3' },
  module4: { moduleId: 'module_4' },
  module5: { moduleId: 'module_5' },
} as const;

type ModuleKey = keyof typeof MODULE_ROW_CONFIG;

const MODULE_QUESTION_KEYS: Record<ModuleKey, readonly string[]> = {
  module1: ['gender', 'expectedGender', 'stage', 'partnerStages', 'locations', 'interests'],
  module2: [
    'q1Schedule', 'q1Attitude', 'q2Space', 'q2Tolerance', 'q3Frequency',
    'q3Bottomline', 'q4Smoking', 'q4Bottomline', 'q5Alcohol', 'q5Bottomline',
  ],
  module3: [
    'q1Slider', 'q1Preference', 'q2Slider', 'q2Preference', 'q3Slider', 'q3Preference',
    'q4Slider', 'q4Preference', 'q5Slider', 'q5Preference', 'q6Slider', 'q6Preference',
    'q7Slider', 'q7Preference', 'q8Slider', 'q8Preference', 'q9Slider', 'q9Preference',
    'q10Slider', 'q10Preference',
  ],
  module4: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
  module5: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'],
};

interface QuestionnaireAnswerRow {
  module_id: string;
  question_id: string;
  answer_value: unknown;
  updated_at?: string;
  created_at?: string;
}

const resolveCurrentUserIdFromLocalStorage = (): string | null => {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as { id?: unknown };
    return typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : null;
  } catch {
    return null;
  }
};

const getStorageKeyByUserId = (userId: string | null): string => {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'guest'}`;
};

const getCurrentStorageKey = (): string => {
  return getStorageKeyByUserId(resolveCurrentUserIdFromLocalStorage());
};

const readLocalQuestionnaire = (): QuestionnaireAnswer | null => {
  const storageKey = getCurrentStorageKey();

  if (questionnaireCache && questionnaireCacheKey === storageKey) {
    return questionnaireCache;
  }

  questionnaireCache = null;
  questionnaireCacheKey = storageKey;

  let stored = localStorage.getItem(storageKey);
  if (!stored) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      stored = legacy;
      localStorage.setItem(storageKey, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  if (!stored) return null;

  try {
    questionnaireCache = JSON.parse(stored);
    return questionnaireCache;
  } catch {
    return null;
  }
};

const writeLocalQuestionnaire = (data: QuestionnaireAnswer): void => {
  const storageKey = getCurrentStorageKey();
  questionnaireCacheKey = storageKey;
  questionnaireCache = data;
  localStorage.setItem(storageKey, JSON.stringify(data));
};

export const getQuestionnaireSnapshot = (): QuestionnaireAnswer | null => {
  return readLocalQuestionnaire();
};

export const resetQuestionnaireSessionCache = (): void => {
  questionnaireCache = null;
  questionnaireCacheKey = null;
  remoteCacheUserId = null;
  resetRemoteSessionState();
};

const resetRemoteSessionState = () => {
  lastRemoteSyncAt = 0;
  remoteLoadPromise = null;
};

const mergeQuestionnaireData = (data: QuestionnaireAnswer): QuestionnaireAnswer => {
  const existingData = readLocalQuestionnaire();
  return {
    ...(existingData ?? {}),
    ...data,
    savedAt: Date.now(),
  };
};

const buildQuestionId = (moduleId: string, questionKey: string): string => {
  return `${moduleId}.${questionKey}`;
};

const upsertModuleRows = async (rows: Array<{
  user_id: string;
  module_id: string;
  question_id: string;
  answer_value: unknown;
}>): Promise<void> => {
  if (!supabase || !rows.length) {
    return;
  }

  const { error } = await supabase
    .from('questionnaire_answers')
    .upsert(rows, { onConflict: 'user_id,question_id' });

  if (error) {
    throw error;
  }
};

const getAuthenticatedUserId = async (): Promise<string | null> => {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
};

const buildRowsFromAnswer = (userId: string, data: QuestionnaireAnswer) => {
  const rows: Array<{
    user_id: string;
    module_id: string;
    question_id: string;
    answer_value: unknown;
  }> = [];

  (Object.keys(MODULE_ROW_CONFIG) as ModuleKey[]).forEach((moduleKey) => {
    const moduleData = data[moduleKey];
    if (!moduleData) return;

    const config = MODULE_ROW_CONFIG[moduleKey];
    const moduleRecord = moduleData as Record<string, unknown>;

    MODULE_QUESTION_KEYS[moduleKey].forEach((questionKey) => {
      if (!(questionKey in moduleRecord)) {
        return;
      }

      rows.push({
        user_id: userId,
        module_id: config.moduleId,
        question_id: buildQuestionId(config.moduleId, questionKey),
        answer_value: moduleRecord[questionKey],
      });
    });
  });

  return rows;
};

const mapRowsToQuestionnaire = (rows: QuestionnaireAnswerRow[]): QuestionnaireAnswer | null => {
  if (!rows.length) return null;

  const result: QuestionnaireAnswer = {};
  let latestSavedAt = 0;

  const resultRecord: Record<string, Record<string, unknown>> = {};

  rows.forEach((row) => {
    const moduleEntry = (Object.entries(MODULE_ROW_CONFIG) as Array<[ModuleKey, (typeof MODULE_ROW_CONFIG)[ModuleKey]]>)
      .find(([, config]) => config.moduleId === row.module_id);

    if (!moduleEntry) return;

    const [moduleKey, config] = moduleEntry;
    const payloadQuestionId = `${config.moduleId}_payload`;

    if (row.question_id === payloadQuestionId && row.answer_value && typeof row.answer_value === 'object') {
      resultRecord[moduleKey] = row.answer_value as Record<string, unknown>;
    } else {
      const prefix = `${config.moduleId}.`;
      if (!row.question_id.startsWith(prefix)) {
        return;
      }

      const questionKey = row.question_id.slice(prefix.length);
      if (!questionKey) {
        return;
      }

      const moduleResult = resultRecord[moduleKey] ?? {};
      moduleResult[questionKey] = row.answer_value;
      resultRecord[moduleKey] = moduleResult;
    }

    (result as Record<string, unknown>)[moduleKey] = resultRecord[moduleKey];

    const timestampSource = row.updated_at ?? row.created_at;
    if (timestampSource) {
      const ts = new Date(timestampSource).getTime();
      if (!Number.isNaN(ts) && ts > latestSavedAt) {
        latestSavedAt = ts;
      }
    }
  });

  if (!Object.keys(result).length) {
    return null;
  }

  if (latestSavedAt > 0) {
    result.savedAt = latestSavedAt;
  }

  return result;
};

const loadFromSupabase = async (userId: string): Promise<QuestionnaireAnswer | null> => {
  if (!supabase) return null;

  const moduleIds = (Object.values(MODULE_ROW_CONFIG) as Array<(typeof MODULE_ROW_CONFIG)[ModuleKey]>).map(
    (item) => item.moduleId
  );

  const { data, error } = await supabase
    .from('questionnaire_answers')
    .select('module_id, question_id, answer_value, updated_at, created_at')
    .eq('user_id', userId)
    .in('module_id', moduleIds);

  if (error) {
    throw error;
  }

  return mapRowsToQuestionnaire((data ?? []) as QuestionnaireAnswerRow[]);
};

const isModule1Complete = (module1: QuestionnaireAnswer['module1']): boolean =>
  Boolean(
    module1 &&
    module1.gender &&
    module1.expectedGender &&
    module1.stage &&
    module1.partnerStages?.length &&
    module1.locations?.length &&
    module1.interests?.length
  );

const isModule2Complete = (module2: QuestionnaireAnswer['module2']): boolean =>
  Boolean(
    module2 &&
    module2.q1Schedule &&
    module2.q1Attitude &&
    module2.q2Space &&
    module2.q2Tolerance &&
    module2.q3Frequency &&
    module2.q3Bottomline &&
    module2.q4Smoking &&
    module2.q4Bottomline &&
    module2.q5Alcohol &&
    module2.q5Bottomline
  );

const isModule3Complete = (module3: QuestionnaireAnswer['module3']): boolean =>
  Boolean(
    module3 &&
    module3.q1Preference &&
    module3.q2Preference &&
    module3.q3Preference &&
    module3.q4Preference &&
    module3.q5Preference &&
    module3.q6Preference &&
    module3.q7Preference &&
    module3.q8Preference &&
    module3.q9Preference &&
    module3.q10Preference
  );

const isModule4Complete = (module4: QuestionnaireAnswer['module4']): boolean =>
  Boolean(
    module4 &&
    module4.q1 &&
    module4.q2 &&
    module4.q3 &&
    module4.q4 &&
    module4.q5 &&
    module4.q6
  );

const isModule5Complete = (module5: QuestionnaireAnswer['module5']): boolean =>
  Boolean(
    module5 &&
    module5.q1 &&
    module5.q2?.length &&
    module5.q3 &&
    module5.q4 &&
    module5.q5 &&
    module5.q6 &&
    module5.q7?.length
  );

export const hasSubmittedQuestionnaire = (): boolean => {
  try {
    const data = readLocalQuestionnaire();
    if (!data) return false;

    return (
      isModule1Complete(data.module1) &&
      isModule2Complete(data.module2) &&
      isModule3Complete(data.module3) &&
      isModule4Complete(data.module4) &&
      isModule5Complete(data.module5)
    );
  } catch {
    return false;
  }
};

/**
 * 问卷答案数据结构
 * 后续后端可沿用此结构，或进行扩展
 */
export interface QuestionnaireAnswer {
  module1?: {
    gender: string;
    expectedGender: string;
    stage: string;
    partnerStages: string[];
    locations: string[];
    interests: string[];
  };
  module2?: {
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
  };
  module3?: {
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
  };
  module4?: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q6: string;
  };
  module5?: {
    q1: string;
    q2: string[];
    q3: string;
    q4: string;
    q5: string;
    q6: string;
    q7: string[];
  };
  savedAt?: number; // 保存时间戳
}

/**
 * 保存问卷答案
 *
 * @param data 问卷答案数据
 * @returns Promise<void>
 *
 * 后端对接示例:
 * ```typescript
 * const saveQuestionnaire = async (data: QuestionnaireAnswer) => {
 *   const response = await fetch('/api/questionnaire/save', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data)
 *   });
 *   if (!response.ok) throw new Error('保存失败');
 * };
 * ```
 */
export const saveQuestionnaire = async (data: QuestionnaireAnswer): Promise<void> => {
  const mergedData = mergeQuestionnaireData(data);

  const userId = await getAuthenticatedUserId();
  if (userId && supabase) {
    try {
      remoteCacheUserId = userId;
      const rows = buildRowsFromAnswer(userId, mergedData);
      await upsertModuleRows(rows);
      lastRemoteSyncAt = Date.now();
    } catch (error) {
      console.error('问卷远端保存失败，已回退到本地缓存:', error);
    }
  }

  writeLocalQuestionnaire(mergedData);

  console.log('问卷已保存', userId ? '(Supabase + localStorage)' : '(localStorage)', mergedData);
};

export const saveQuestionnaireModule = async <K extends ModuleKey>(
  moduleKey: K,
  moduleData: NonNullable<QuestionnaireAnswer[K]>
): Promise<void> => {
  const mergedData = mergeQuestionnaireData({
    [moduleKey]: moduleData,
  } as Pick<QuestionnaireAnswer, K> as QuestionnaireAnswer);

  const userId = await getAuthenticatedUserId();
  if (userId && supabase) {
    try {
      remoteCacheUserId = userId;
      const config = MODULE_ROW_CONFIG[moduleKey];
      const moduleRecord = moduleData as Record<string, unknown>;

      const rows = MODULE_QUESTION_KEYS[moduleKey]
        .filter((questionKey) => questionKey in moduleRecord)
        .map((questionKey) => ({
          user_id: userId,
          module_id: config.moduleId,
          question_id: buildQuestionId(config.moduleId, questionKey),
          answer_value: moduleRecord[questionKey],
        }));

      await upsertModuleRows(rows);
      lastRemoteSyncAt = Date.now();
    } catch (error) {
      console.error('问卷模块远端保存失败，已回退到本地缓存:', error);
    }
  }

  writeLocalQuestionnaire(mergedData);
};

/**
 * 加载已保存的问卷答案
 *
 * @returns Promise<QuestionnaireAnswer | null> 返回保存的数据，若无则返回 null
 *
 * 后端对接示例:
 * ```typescript
 * const loadQuestionnaire = async (): Promise<QuestionnaireAnswer | null> => {
 *   const response = await fetch('/api/questionnaire/load');
 *   if (response.status === 404) return null;
 *   return response.json();
 * };
 * ```
 */
export const loadQuestionnaire = async (): Promise<QuestionnaireAnswer | null> => {
  try {
    const localData = readLocalQuestionnaire();
    const userId = await getAuthenticatedUserId();
    if (userId && supabase) {
      if (remoteCacheUserId !== userId) {
        remoteCacheUserId = userId;
        resetRemoteSessionState();
      }

      if (localData && Date.now() - lastRemoteSyncAt < REMOTE_SYNC_TTL_MS) {
        return localData;
      }

      try {
        if (!remoteLoadPromise) {
          remoteLoadPromise = loadFromSupabase(userId).finally(() => {
            remoteLoadPromise = null;
          });
        }

        const remoteData = await remoteLoadPromise;
        lastRemoteSyncAt = Date.now();
        if (remoteData) {
          writeLocalQuestionnaire(remoteData);
          return remoteData;
        }
      } catch (error) {
        console.error('问卷远端加载失败，尝试读取本地缓存:', error);
      }
    } else {
      remoteCacheUserId = null;
      resetRemoteSessionState();
    }

    return localData;
  } catch {
    return readLocalQuestionnaire();
  }
};

/**
 * 清除已保存的问卷答案
 *
 * @returns Promise<void>
 *
 * 后端对接示例:
 * ```typescript
 * const clearQuestionnaire = async (): Promise<void> => {
 *   await fetch('/api/questionnaire/clear', { method: 'DELETE' });
 * };
 * ```
 */
export const clearQuestionnaire = async (): Promise<void> => {
  const userId = await getAuthenticatedUserId();
  if (userId && supabase) {
    try {
      const moduleIds = (Object.values(MODULE_ROW_CONFIG) as Array<(typeof MODULE_ROW_CONFIG)[ModuleKey]>).map(
        (item) => item.moduleId
      );

      const { error } = await supabase
        .from('questionnaire_answers')
        .delete()
        .eq('user_id', userId)
        .in('module_id', moduleIds);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('问卷远端清除失败，继续清除本地缓存:', error);
    }
  }

  const storageKey = getCurrentStorageKey();
  localStorage.removeItem(storageKey);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  resetQuestionnaireSessionCache();
  console.log('问卷数据已清除');
};

/**
 * 获取保存状态信息
 *
 * @returns 字符串，包含保存时间和完成进度
 */
export const getSaveStatus = async (): Promise<string> => {
  const data = await loadQuestionnaire();
  if (!data?.savedAt) return '';

  const date = new Date(data.savedAt);
  const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  // 计算完成进度（简单估算）
  let completed = 0;
  if (data.module1) completed += 5;
  if (data.module2) completed += 5;
  if (data.module3) completed += 10;
  if (data.module4) completed += 6;
  if (data.module5) completed += 7;

  return `上次保存: ${timeStr} (${completed}/${QUESTIONNAIRE_TOTAL_QUESTIONS}题)`;
};