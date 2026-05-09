/**
 * Hungarian 算法（Kuhn-Munkres 算法）
 *
 * 用于在加权二部图中找最大权和匹配
 * 适用于用户池较大时的全局优化
 *
 * 时间复杂度: O(n³)
 * 适用于 100-500 用户规模
 */

import { CandidateUser, MatchScore } from "./types.ts";

interface MatchPair {
  leftId: string;
  rightId: string;
  score: number;
}

/**
 * Hungarian 算法实现（最大化版本）
 *
 * @param leftPool 左集合（男性用户）
 * @param rightPool 右集合（女性用户）
 * @param scoreMatrix 分数矩阵
 * @returns 匹配对数组
 */
export function hungarianMatch(
  leftPool: CandidateUser[],
  rightPool: CandidateUser[],
  scoreMatrix: Map<string, Map<string, MatchScore>>
): MatchPair[] {
  const n = Math.max(leftPool.length, rightPool.length);
  if (n === 0) return [];
  if (leftPool.length === 0 || rightPool.length === 0) return [];

  // 重要：当前 KM 实现要求列数 >= 行数（m >= n）。
  // 当 leftPool 比 rightPool 更大时，交换两侧来避免矩形分配问题导致的死循环。
  let effectiveLeftPool = leftPool;
  let effectiveRightPool = rightPool;
  let swapped = false;

  if (leftPool.length > rightPool.length) {
    swapped = true;
    effectiveLeftPool = rightPool;
    effectiveRightPool = leftPool;
  }

  const leftIds = effectiveLeftPool.map((u) => u.id);
  const rightIds = effectiveRightPool.map((u) => u.id);

  // 构建分数矩阵（直接使用分数，不取负）
  // weights[i][j] = leftPool[i] 与 rightPool[j] 的分数
  const weights: number[][] = [];
  for (let i = 0; i < effectiveLeftPool.length; i++) {
    weights[i] = [];
    for (let j = 0; j < effectiveRightPool.length; j++) {
      const score =
        scoreMatrix.get(leftIds[i])?.get(rightIds[j])?.total ??
        scoreMatrix.get(rightIds[j])?.get(leftIds[i])?.total ??
        0;
      weights[i][j] = score;
    }
  }

  // 使用 KM 算法找最大权和匹配
  const matchResult = kmMatch(weights, effectiveLeftPool.length, effectiveRightPool.length);

  // 提取有效匹配
  const pairs: MatchPair[] = [];
  for (const [i, j] of matchResult) {
    const score = weights[i][j];
    if (score > 0) {
      const rawLeftId = leftIds[i];
      const rawRightId = rightIds[j];

      const leftId = swapped ? rawRightId : rawLeftId;
      const rightId = swapped ? rawLeftId : rawRightId;

      const normalizedScore =
        scoreMatrix.get(leftId)?.get(rightId)?.total ??
        scoreMatrix.get(rightId)?.get(leftId)?.total ??
        score;

      pairs.push({ leftId, rightId, score: normalizedScore });
    }
  }

  return pairs;
}

/**
 * Kuhn-Munkres (KM) 算法实现
 * 用于找二分图最大权匹配
 *
 * @param weights 分数矩阵 (leftSize x rightSize)
 * @param n 左集合大小
 * @param m 右集合大小
 * @returns 匹配对列表 [leftIndex, rightIndex]
 */
function kmMatch(weights: number[][], n: number, m: number): [number, number][] {
  if (n === 0 || m === 0) return [];

  // 确保 n <= m（如果右集合更大，算法仍可工作）
  const result: [number, number][] = [];

  // 初始化顶标（slack）
  // u[i] = 左集合顶点 i 的顶标
  // v[j] = 右集合顶点 j 的顶标
  const u: number[] = new Array(n + 1).fill(0);
  const v: number[] = new Array(m + 1).fill(0);
  const p: number[] = new Array(m + 1).fill(0); // p[j] = 与右顶点 j 匹配的左顶点
  const way: number[] = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    const visited = new Array(m + 1).fill(false);
    let j0 = 0;
    way[0] = i;

    // 初始化 slack
    // slack[j] = min(u[i] + v[j] - weights[i-1][j-1]) for unvisited j
    const slack = new Array(m + 1).fill(Infinity);

    do {
      visited[j0] = true;
      const i0 = p[j0];
      let j1 = 0;
      let delta = Infinity;

      for (let j = 1; j <= m; j++) {
        if (visited[j]) continue;

        // 计算新的 slack
        const cur = u[i0] + v[j] - weights[i0 - 1][j - 1];
        if (cur < slack[j]) {
          slack[j] = cur;
          way[j] = j0;
        }

        if (slack[j] < delta) {
          delta = slack[j];
          j1 = j;
        }
      }

      // 更新顶标
      for (let j = 0; j <= m; j++) {
        if (visited[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          slack[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    // 回溯修改匹配
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // 提取匹配结果
  for (let j = 1; j <= m; j++) {
    if (p[j] !== 0) {
      result.push([p[j] - 1, j - 1]);
    }
  }

  return result;
}

/**
 * 贪婪补充匹配
 *
 * 当 Hungarian 匹配完成后，对于未匹配的用户
 * 使用贪婪策略尝试补充匹配
 */
export function greedySupplement(
  leftPool: CandidateUser[],
  rightPool: CandidateUser[],
  scoreMatrix: Map<string, Map<string, MatchScore>>,
  existingMatches: Set<string>,
  maxMatchesPerUser: number = 1,
  minScoreThreshold: number = 55
): MatchPair[] {
  const matchCountByUser = new Map<string, number>();

  const bump = (userId: string) => {
    matchCountByUser.set(userId, (matchCountByUser.get(userId) ?? 0) + 1);
  };

  // 记录已匹配的用户（左右两侧都计数，保证“每人最多N个配对”）
  for (const match of existingMatches) {
    const [leftId, rightId] = match.split("-");
    if (leftId) bump(leftId);
    if (rightId) bump(rightId);
  }

  const supplements: MatchPair[] = [];

  // 为未匹配的左用户找最佳候选
  // greedySupplement 的语义是“补齐未匹配用户”，而不是给已匹配用户继续补到上限。
  const unmatchedLeft = leftPool.filter((u) => (matchCountByUser.get(u.id) ?? 0) === 0);
  for (const left of unmatchedLeft) {
    if ((matchCountByUser.get(left.id) ?? 0) !== 0) continue;

    const candidates = rightPool
      .filter((r) => r.id !== left.id)
      .filter((r) => (matchCountByUser.get(r.id) ?? 0) === 0)
      .map((r) => ({
        id: r.id,
        score: scoreMatrix.get(left.id)?.get(r.id)?.total ?? 0,
      }))
      .filter((c) => c.score >= minScoreThreshold)
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const best = candidates[0];
      supplements.push({
        leftId: left.id,
        rightId: best.id,
        score: best.score,
      });
      bump(left.id);
      bump(best.id);
    }
  }

  return supplements;
}

/**
 * 批量匹配入口
 *
 * 组合 Hungarian 算法和贪婪补充
 */
export function batchMatch(
  leftPool: CandidateUser[],
  rightPool: CandidateUser[],
  scoreMatrix: Map<string, Map<string, MatchScore>>,
  options: {
    useHungarianFirst?: boolean;
    maxMatchesPerUser?: number;
    minScoreThreshold?: number;
  } = {}
): MatchPair[] {
  const {
    useHungarianFirst = true,
    maxMatchesPerUser = 1,
    minScoreThreshold = 55,
  } = options;

  const allPairs: MatchPair[] = [];

  if (useHungarianFirst && leftPool.length >= 2 && rightPool.length >= 2) {
    // 首先使用 Hungarian 算法
    const hungarianPairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
    allPairs.push(...hungarianPairs);
  }

  // 贪婪补充
  const existingSet = new Set(allPairs.map((p) =>
    p.leftId < p.rightId ? `${p.leftId}-${p.rightId}` : `${p.rightId}-${p.leftId}`
  ));

  const supplementPairs = greedySupplement(
    leftPool,
    rightPool,
    scoreMatrix,
    existingSet,
    maxMatchesPerUser,
    minScoreThreshold
  );

  allPairs.push(...supplementPairs);

  return allPairs;
}
