/**
 * Supabase Edge Function: Match Scheduler
 *
 * 目标：每周执行一次匹配任务（每用户最多 1 个配对）
 * - 触发频率：每周三 11:55（北京时间）触发生成结果，12:00 正式揭晓/通知（Cron 需按 UTC 配置，参考 docs/SUPABASE_SETUP.md）
 *
 * 算法实现：
 * 1. 收集本周所有参与者及其问卷数据
 * 2. 预计算所有候选配对的匹配分数（0-100 百分制）
 * 3. 根据规模选择匹配算法（小规模 G-S；大规模 Hungarian/Greedy 组合）
 * 4. 生成匹配报告
 * 5. 写入 matches 表并清空 match_pool
 *
 * 部署：supabase functions deploy match-scheduler
 * 测试：supabase functions invoke match-scheduler --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  CandidateUser,
  MatchResult,
  MatchScore,
  MatchReport,
  Module1Answers,
  Module2Answers,
  Module3Answers,
  Module4Answers,
  Module5Answers,
  WEIGHTS,
  MIN_SCORE_THRESHOLD,
  calculateMatchScore,
  calculateScoreFast,
  canPossiblyMatch,
  runGaleShapleyMatching,
  groupUsersByPreference,
  buildScoreMatrix,
  batchMatch,
} from "./matching/index.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * 获取本周标签（YYYY-WW 格式）
 */
function getWeekTag(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * 将数据库答案记录转换为问卷结构
 */
function buildQuestionnaireFromRecords(
  records: { module_id: string; question_id: string; answer_value: any }[]
): {
  module1?: Module1Answers;
  module2?: Module2Answers;
  module3?: Module3Answers;
  module4?: Module4Answers;
  module5?: Module5Answers;
} {
  const questionnaire: any = {};

  for (const record of records) {
    const { module_id, question_id, answer_value } = record;
    const parts = question_id.split(".");
    if (parts.length !== 2) continue;

    const [, questionKey] = parts;

    if (!questionnaire[module_id]) {
      questionnaire[module_id] = {};
    }
    questionnaire[module_id][questionKey] = answer_value;
  }

  return {
    module1: questionnaire.module_1,
    module2: questionnaire.module_2,
    module3: questionnaire.module_3,
    module4: questionnaire.module_4,
    module5: questionnaire.module_5,
  };
}

/**
 * 轻量评分：只返回总分数字，用于构建分数矩阵
 * 完整 MatchScore 在匹配成功后按需生成
 */
function calculatePairScoreFast(a: CandidateUser, b: CandidateUser): number {
  return calculateScoreFast(
    a.profile,
    b.profile,
    a.questionnaire,
    b.questionnaire
  );
}

/**
 * 生成匹配报告
 */
function generateMatchReport(
  match: MatchResult,
  profileA: any,
  profileB: any,
  answersA: any,
  answersB: any
): MatchReport {
  const { dimensions } = match.score;

  // 生成匹配原因文案
  const reasons: string[] = [];
  if (dimensions.valueAlignment >= 80) {
    reasons.push("你们的人生观和价值观非常契合");
  }
  if (dimensions.lifestyleFit >= 80) {
    reasons.push("日常生活习惯高度协调");
  }
  if (dimensions.personalityMatch >= 80) {
    reasons.push("性格特质形成良好互补");
  }
  if (dimensions.interestOverlap >= 75) {
    reasons.push("兴趣爱好有较多交集");
  }
  if (dimensions.expectationMatch >= 75) {
    reasons.push("对理想伴侣的期望高度一致");
  }

  // 生成话题建议
  const topics: string[] = [];
  if (profileA.locations && profileB.locations) {
    const sharedLocations = (profileA.locations as string[]).filter(
      (l: string) => (profileB.locations as string[]).includes(l)
    );
    if (sharedLocations.length > 0) {
      topics.push(...sharedLocations.slice(0, 2));
    }
  }

  return {
    matchId: match.id,
    compatibility: {
      valueAlignment: dimensions.valueAlignment,
      lifestyleFit: dimensions.lifestyleFit,
      personalityMatch: dimensions.personalityMatch,
      interestOverlap: dimensions.interestOverlap,
      expectationMatch: dimensions.expectationMatch,
    },
    radarData: {
      label: ["价值观", "生活习惯", "性格互补", "兴趣重叠", "期望匹配"],
      score: [
        dimensions.valueAlignment,
        dimensions.lifestyleFit,
        dimensions.personalityMatch,
        dimensions.interestOverlap,
        dimensions.expectationMatch,
      ],
    },
    matchReason:
      reasons.length > 0
        ? reasons.join("，")
        : "在多个维度都有不错的契合度",
    highlightTopics:
      topics.length > 0 ? topics : ["校园生活", "兴趣爱好"],
  };
}

/**
 * 批量获取所有候选人的历史匹配记录
 * 返回一个 Set，包含所有已经匹配过的 (user_a_id, user_b_id) 对
 * 分批查询避免单次 IN/OR 条件 URL 过长
 */
async function getHistoricalMatchSet(
  client: any,
  userIds: string[]
): Promise<Set<string>> {
  const pairs = new Set<string>();
  const BATCH_SIZE = 100;
  const PAGE_SIZE = 1000;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    let page = 0;
    while (true) {
      const { data, error } = await client
        .from("matches")
        .select("user_a_id, user_b_id")
        .or(
          batch.map((id) => `user_a_id.eq.${id},user_b_id.eq.${id}`).join(",")
        )
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order("created_at");

      if (error) {
        console.error("Failed to fetch historical matches:", error);
        break;
      }
      if (!data || data.length === 0) break;

      for (const m of data as any[]) {
        const key =
          m.user_a_id < m.user_b_id
            ? `${m.user_a_id}-${m.user_b_id}`
            : `${m.user_b_id}-${m.user_a_id}`;
        pairs.add(key);
      }
      page++;
    }
  }

  return pairs;
}

/**
 * 主匹配函数
 */
async function runMatching(client: any, weekTag: string) {
  console.log(`Starting Gale-Shapley match scheduler for week: ${weekTag}`);

  try {
    // 1. 查询本周参与者池
    console.log("1. 获取本周参与者池...");
    const { data: poolUsers, error: poolError } = await client
      .from("match_pool")
      .select("user_id")
      .eq("week_tag", weekTag);

    if (poolError) throw poolError;
    if (!poolUsers || poolUsers.length === 0) {
      console.log("No users in match pool this week");
      return { success: true, matchesCreated: 0 };
    }

    const userIds = poolUsers.map((p: { user_id: string }) => p.user_id);
    console.log(`Pool size: ${userIds.length}`);

    // 将用户 ID 分批，避免单次 IN 查询 URL 过长
    const BATCH_SIZE = 100;
    const idBatches: string[][] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      idBatches.push(userIds.slice(i, i + BATCH_SIZE));
    }

    // 2. 分批获取用户资料
    console.log(`2. 获取用户资料 (${idBatches.length} 批)...`);
    const profiles: any[] = [];
    for (const batch of idBatches) {
      const { data: batchProfiles, error: profileError } = await client
        .from("profiles")
        .select("*")
        .in("id", batch);

      if (profileError) throw profileError;
      if (batchProfiles) profiles.push(...batchProfiles);
    }

    if (profiles.length < 2) {
      console.log("Not enough users for matching");
      return { success: true, matchesCreated: 0 };
    }

    // 3. 分批获取问卷答案（含分页，避免默认 1000 行截断）
    console.log(`3. 获取问卷答案 (${idBatches.length} 批)...`);
    const answerRecords: any[] = [];
    const QA_PAGE_SIZE = 1000;

    for (const batch of idBatches) {
      let page = 0;
      while (true) {
        const { data: pageRecords, error: answerError } = await client
          .from("questionnaire_answers")
          .select("user_id, module_id, question_id, answer_value")
          .in("user_id", batch)
          .range(page * QA_PAGE_SIZE, (page + 1) * QA_PAGE_SIZE - 1)
          .order("user_id");

        if (answerError) throw answerError;
        if (!pageRecords || pageRecords.length === 0) break;

        answerRecords.push(...pageRecords);
        page++;
      }
    }
    console.log(`  Fetched ${answerRecords.length} answer records`);

    // 4. 构建用户数据
    console.log("4. 构建用户数据...");

    // 按用户分组问卷答案
    const answersByUser = new Map<string, any[]>();
    for (const ans of answerRecords as any[]) {
      if (!answersByUser.has(ans.user_id)) {
        answersByUser.set(ans.user_id, []);
      }
      answersByUser.get(ans.user_id)!.push(ans);
    }

    // 构建候选人列表
    const candidates: CandidateUser[] = [];
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      const answerRecords = answersByUser.get(userId) || [];
      const questionnaire = buildQuestionnaireFromRecords(answerRecords);

      // 跳过问卷未完成的用户
      if (!questionnaire.module1 || !questionnaire.module2) {
        console.log(`User ${userId} skipped: incomplete questionnaire`);
        continue;
      }

      candidates.push({
        id: userId,
        profile: {
          id: profile.id,
          gender: profile.gender,
          stage: profile.stage,
          expected_gender: profile.expected_gender,
          partner_stages: profile.partner_stages || [],
          locations: profile.locations || [],
          questionnaire_completed: profile.questionnaire_completed,
        },
        questionnaire,
        matchState: {
          preferences: [],
          receivedOffers: new Map(),
          matchedUsers: [],
          rejectedOffers: new Set(),
        },
      });
    }

    console.log(`Valid candidates: ${candidates.length}`);

    if (candidates.length < 2) {
      console.log("Not enough valid candidates for matching");
      return { success: true, matchesCreated: 0 };
    }

    // 5. 预计算所有候选对分数（轻量：只存数字总分）
    console.log("5. 预计算匹配分数...");
    const scoreMatrix = buildScoreMatrix(candidates, calculatePairScoreFast);
    console.log(`  Score matrix: ${scoreMatrix.size} rows`);

    // 6. 批量获取历史匹配记录（避免 O(n²) DB 查询）
    console.log("6. 获取历史匹配记录...");
    const historicalPairs = await getHistoricalMatchSet(
      client,
      candidates.map((c) => c.id)
    );
    console.log(`  Historical pairs found: ${historicalPairs.size}`);

    // 过滤掉历史匹配过的用户对
    const filteredCandidates: CandidateUser[] = [];
    const validPairKeys = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const pairKey =
          a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;

        if (historicalPairs.has(pairKey)) continue;

        validPairKeys.add(pairKey);
      }
    }

    // 过滤候选列表
    for (const candidate of candidates) {
      let hasValidPair = false;
      for (const other of candidates) {
        if (candidate.id === other.id) continue;
        const pairKey =
          candidate.id < other.id
            ? `${candidate.id}-${other.id}`
            : `${other.id}-${candidate.id}`;
        if (validPairKeys.has(pairKey)) {
          hasValidPair = true;
          break;
        }
      }
      if (hasValidPair) {
        filteredCandidates.push(candidate);
      }
    }

    console.log(`Candidates after filtering: ${filteredCandidates.length}`);

    // 7. 执行匹配算法
    console.log("7. 执行匹配算法...");
    let matchResults: MatchResult[] = [];

    if (filteredCandidates.length <= 50) {
      console.log("  Using Gale-Shapley algorithm...");
      matchResults = await runGaleShapleyMatching(
        filteredCandidates,
        weekTag,
        scoreMatrix
      );
    } else {
      // 大规模用户池：分组后使用 Hungarian 算法
      console.log("  Using batch matching with Hungarian algorithm...");
      const groups = groupUsersByPreference(filteredCandidates);
      console.log(
        `Groups: malePreferFemale=${groups.malePreferFemale.length}, ` +
          `femalePreferMale=${groups.femalePreferMale.length}, ` +
          `bothPool=${groups.bothPool.length}`
      );

      // 主要匹配：malePreferFemale vs femalePreferMale
      const primaryPairs = batchMatch(
        groups.malePreferFemale,
        groups.femalePreferMale,
        scoreMatrix,
        { useHungarianFirst: true, maxMatchesPerUser: 1, minScoreThreshold: MIN_SCORE_THRESHOLD }
      );

      // bothPool 内部匹配
      const bothPairs = batchMatch(
        groups.bothPool,
        groups.bothPool,
        scoreMatrix,
        { useHungarianFirst: false, maxMatchesPerUser: 1, minScoreThreshold: MIN_SCORE_THRESHOLD }
      );

      // 合并结果
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const expiresAtStr = expiresAt.toISOString();
      const createdAt = new Date().toISOString();

      const allPairs = [...primaryPairs, ...bothPairs];
      const processedPairs = new Set<string>();

      for (const pair of allPairs) {
        const pairKey =
          pair.leftId < pair.rightId
            ? `${pair.leftId}-${pair.rightId}`
            : `${pair.rightId}-${pair.leftId}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const scoreTotal =
          scoreMatrix.get(pair.leftId)?.get(pair.rightId) ??
          scoreMatrix.get(pair.rightId)?.get(pair.leftId);

        if (!scoreTotal || scoreTotal < MIN_SCORE_THRESHOLD) continue;

        matchResults.push({
          id: crypto.randomUUID(),
          userAId: pair.leftId,
          userBId: pair.rightId,
          score: { total: scoreTotal, dimensions: { valueAlignment: 0, lifestyleFit: 0, personalityMatch: 0, interestOverlap: 0, expectationMatch: 0 } },
          weekTag,
          status: "pending",
          expiresAt: expiresAtStr,
          createdAt,
        });
      }
    }

    console.log(`Match results: ${matchResults.length} pairs`);

    // 8. 写入匹配结果和报告
    console.log("8. 写入匹配结果...");
    let matchesCreated = 0;

    for (const match of matchResults) {
      // 插入 matches 表
      const { error: insertError } = await client.from("matches").insert([
        {
          id: match.id,
          user_a_id: match.userAId,
          user_b_id: match.userBId,
          match_rate: match.score.total,
          week_tag: weekTag,
          status: "matched",
          expires_at: match.expiresAt,
          created_at: match.createdAt,
        },
      ]);

      if (insertError) {
        console.error(`Failed to insert match:`, insertError);
        continue;
      }

      // 生成并插入 match_reports 表
      const profileA = profileMap.get(match.userAId);
      const profileB = profileMap.get(match.userBId);
      const candidateA = candidates.find((c) => c.id === match.userAId);
      const candidateB = candidates.find((c) => c.id === match.userBId);

      if (profileA && profileB && candidateA && candidateB) {
        // 按需计算完整 MatchScore（含维度明细），用于报告生成
        match.score = calculateMatchScore(
          profileA,
          profileB,
          candidateA.questionnaire,
          candidateB.questionnaire
        );

        const report = generateMatchReport(
          match,
          profileA,
          profileB,
          candidateA.questionnaire,
          candidateB.questionnaire
        );

        await client.from("match_reports").insert([
          {
            match_id: match.id,
            content: JSON.stringify({
              compatibility_score: match.score.total,
              dimensions: [
                {
                  name: "价值观契合度",
                  score: report.compatibility.valueAlignment,
                  weight: WEIGHTS.valueAlignment,
                },
                {
                  name: "生活习惯匹配",
                  score: report.compatibility.lifestyleFit,
                  weight: WEIGHTS.lifestyleFit,
                },
                {
                  name: "性格互补度",
                  score: report.compatibility.personalityMatch,
                  weight: WEIGHTS.personalityMatch,
                },
                {
                  name: "兴趣重叠度",
                  score: report.compatibility.interestOverlap,
                  weight: WEIGHTS.interestOverlap,
                },
                {
                  name: "期望匹配度",
                  score: report.compatibility.expectationMatch,
                  weight: WEIGHTS.expectationMatch,
                },
              ],
              radar_data: report.radarData,
              summary: report.matchReason,
              highlight_topics: report.highlightTopics,
            }),
          },
        ]);
      }

      matchesCreated++;
    }

    console.log(`匹配完成，创建了 ${matchesCreated} 个匹配`);

    // 9. 清空本周 match_pool
    console.log("9. 清空本周匹配池...");
    await client.from("match_pool").delete().eq("week_tag", weekTag);

    // 10. 统计未匹配用户
    const matchedUserIds = new Set<string>();
    for (const match of matchResults) {
      matchedUserIds.add(match.userAId);
      matchedUserIds.add(match.userBId);
    }
    const unmatchedCount = candidates.length - matchedUserIds.size;

    return {
      success: true,
      matchesCreated,
      unmatchedCount,
      totalCandidates: candidates.length,
      filteredCandidates: filteredCandidates.length,
      weekTag,
    };
  } catch (error) {
    console.error("Matching error:", error);
    throw error;
  }
}

serve(async (req) => {
  // 只允许 POST 请求
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 初始化 Supabase 客户端（使用 service_role 密钥）
    const client = createClient(supabaseUrl!, supabaseServiceRoleKey!);

    // 获取本周标签
    const weekTag = getWeekTag();

    // 执行匹配
    const result = await runMatching(client, weekTag);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
