/**
 * Gale-Shapley 变体匹配算法
 *
 * 适配多性别偏好场景：
 * - 用户可以期望 male、female 或 both
 * - 每个用户最多获得 MAX_MATCHES_PER_USER 个匹配（当前为 1）
 * - 质量优先：只有超过 MIN_SCORE_THRESHOLD 的匹配才会被接受
 *
 * 算法流程：
 * 1. 分组：按性别期望将用户分成不同池子
 * 2. 预计算：为每个用户计算所有候选的匹配分数（轻量，只存数字）
 * 3. 构建偏好列表：按分数降序排列
 * 4. 延迟接受：迭代处理，直到收敛或达到最大轮次
 *
 * scoreMatrix 类型: Map<userId, Map<otherId, number>>（只存总分，节省内存）
 */

import {
  CandidateUser,
  MatchResult,
  MAX_MATCHES_PER_USER,
  MIN_SCORE_THRESHOLD,
} from "./types.ts";

interface UserMatchState {
  userId: string;
  matchedUsers: Set<string>;
  rejectedUsers: Set<string>;
}

/**
 * Gale-Shapley 变体匹配算法
 * scoreMatrix: Map<userId, Map<otherId, scoreTotal>>
 */
export async function runGaleShapleyMatching(
  candidates: CandidateUser[],
  weekTag: string,
  scoreMatrix: Map<string, Map<string, number>>,
  getCurrentTime: () => string = () => new Date().toISOString()
): Promise<MatchResult[]> {
  console.log(`Starting Gale-Shapley matching with ${candidates.length} candidates`);

  if (candidates.length < 2) {
    console.log("Not enough candidates for matching");
    return [];
  }

  // 初始化匹配状态
  const matchStates = new Map<string, UserMatchState>();
  for (const candidate of candidates) {
    matchStates.set(candidate.id, {
      userId: candidate.id,
      matchedUsers: new Set(),
      rejectedUsers: new Set(),
    });
  }

  // 构建每个用户的偏好列表（按分数降序）
  const preferences = new Map<string, { userId: string; score: number }[]>();
  for (const candidate of candidates) {
    const userPrefs: { userId: string; score: number }[] = [];

    for (const other of candidates) {
      if (candidate.id === other.id) continue;

      const score = scoreMatrix.get(candidate.id)?.get(other.id);
      if (score !== undefined && score >= MIN_SCORE_THRESHOLD) {
        userPrefs.push({ userId: other.id, score });
      }
    }

    userPrefs.sort((a, b) => b.score - a.score);
    preferences.set(candidate.id, userPrefs);
  }

  console.log(`Built preference lists for ${preferences.size} users`);

  // 延迟接受算法迭代
  const maxIterations = 10;
  let iteration = 0;
  let changed = true;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const candidate of candidates) {
      const state = matchStates.get(candidate.id)!;
      const prefs = preferences.get(candidate.id) || [];

      for (const pref of prefs) {
        if (state.rejectedUsers.has(pref.userId)) continue;
        if (state.matchedUsers.has(pref.userId)) continue;

        const targetState = matchStates.get(pref.userId)!;

        if (targetState.matchedUsers.size < MAX_MATCHES_PER_USER) {
          state.matchedUsers.add(pref.userId);
          targetState.matchedUsers.add(candidate.id);
          changed = true;
          break;
        } else {
          let lowestScore = Infinity;
          let lowestMatchedUserId: string | null = null;

          for (const matchedId of targetState.matchedUsers) {
            const s = scoreMatrix.get(pref.userId)?.get(matchedId);
            if (s !== undefined && s < lowestScore) {
              lowestScore = s;
              lowestMatchedUserId = matchedId;
            }
          }

          if (lowestMatchedUserId && pref.score > lowestScore) {
            state.matchedUsers.add(pref.userId);
            targetState.matchedUsers.delete(lowestMatchedUserId);
            matchStates.get(lowestMatchedUserId)!.rejectedUsers.add(pref.userId);
            matchStates.get(lowestMatchedUserId)!.matchedUsers.delete(pref.userId);
            changed = true;
            break;
          } else {
            state.rejectedUsers.add(pref.userId);
          }
        }
      }
    }

    console.log(`Iteration ${iteration}: ${countTotalMatches(matchStates)} matches`);
  }

  console.log(`Gale-Shapley converged after ${iteration} iterations`);

  // 生成匹配结果（不包含 MatchScore，只存总分，调用方后续补全维度）
  const results: MatchResult[] = [];
  const processedPairs = new Set<string>();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const expiresAtStr = expiresAt.toISOString();
  const createdAt = getCurrentTime();

  for (const [userId, state] of matchStates.entries()) {
    for (const matchedId of state.matchedUsers) {
      const pairKey = userId < matchedId ? `${userId}-${matchedId}` : `${matchedId}-${userId}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const scoreTotal = scoreMatrix.get(userId)?.get(matchedId) ??
                         scoreMatrix.get(matchedId)?.get(userId);

      if (scoreTotal === undefined) continue;

      results.push({
        id: crypto.randomUUID(),
        userAId: userId < matchedId ? userId : matchedId,
        userBId: userId < matchedId ? matchedId : userId,
        score: { total: scoreTotal, dimensions: { valueAlignment: 0, lifestyleFit: 0, personalityMatch: 0, interestOverlap: 0, expectationMatch: 0 } },
        weekTag,
        status: "pending",
        expiresAt: expiresAtStr,
        createdAt,
      });
    }
  }

  console.log(`Generated ${results.length} match results`);
  return results;
}

function countTotalMatches(states: Map<string, UserMatchState>): number {
  let total = 0;
  for (const state of states.values()) {
    total += state.matchedUsers.size;
  }
  return total / 2; // 每个匹配被计算了两次
}

/**
 * 构建用户分组
 * 用于支持多性别偏好的匹配
 */
export function groupUsersByPreference(
  candidates: CandidateUser[]
): {
  malePreferFemale: CandidateUser[];
  femalePreferMale: CandidateUser[];
  bothPool: CandidateUser[];
} {
  const malePreferFemale: CandidateUser[] = [];
  const femalePreferMale: CandidateUser[] = [];
  const bothPool: CandidateUser[] = [];

  for (const candidate of candidates) {
    const gender = candidate.profile.gender;
    const expectedGender = candidate.profile.expected_gender;

    if (expectedGender === "both") {
      bothPool.push(candidate);
    } else if (gender === "male" && expectedGender === "female") {
      malePreferFemale.push(candidate);
    } else if (gender === "female" && expectedGender === "male") {
      femalePreferMale.push(candidate);
    } else {
      // 性别偏好不明确，归入 bothPool
      bothPool.push(candidate);
    }
  }

  return { malePreferFemale, femalePreferMale, bothPool };
}

/**
 * 为特定分组的用户预计算匹配分数矩阵（轻量：只存数字总分）
 */
export function buildScoreMatrix(
  candidates: CandidateUser[],
  calculateScore: (a: CandidateUser, b: CandidateUser) => number
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const a of candidates) {
    const row = new Map<string, number>();
    for (const b of candidates) {
      if (a.id === b.id) continue;
      const score = calculateScore(a, b);
      if (score > 0) {
        row.set(b.id, score);
      }
    }
    matrix.set(a.id, row);
  }

  return matrix;
}
