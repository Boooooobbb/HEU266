/**
 * Supabase Edge Function: Match Scheduler
 *
 * 目标：每周执行一次匹配任务（每用户最多 1 个配对）
 * - 触发频率：每周五晚上 8 点 (Cron: 0 20 * * FRI)
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
 * 为主匹配函数计算两个候选人的分数
 */
function calculatePairScore(a: CandidateUser, b: CandidateUser): MatchScore {
  return calculateMatchScore(
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
 * 检查历史匹配
 */
async function hasPreviousMatch(
  client: any,
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  const { data } = await client
    .from("matches")
    .select("id")
    .or(
      `user_a_id.eq.${userIdA},user_a_id.eq.${userIdB}`
    )
    .or(
      `user_b_id.eq.${userIdA},user_b_id.eq.${userIdB}`
    )
    .limit(1);

  return (data?.length ?? 0) > 0;
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

    // 2. 获取用户资料
    console.log("2. 获取用户资料...");
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (profileError) throw profileError;
    if (!profiles || profiles.length < 2) {
      console.log("Not enough users for matching");
      return { success: true, matchesCreated: 0 };
    }

    // 3. 获取问卷答案
    console.log("3. 获取问卷答案...");
    const { data: answerRecords, error: answerError } = await client
      .from("questionnaire_answers")
      .select("user_id, module_id, question_id, answer_value")
      .in("user_id", userIds);

    if (answerError) throw answerError;

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

    // 5. 预计算所有候选对分数
    console.log("5. 预计算匹配分数...");
    const scoreMatrix = buildScoreMatrix(candidates, calculatePairScore);

    // 6. 执行匹配算法
    console.log("6. 执行匹配算法...");

    // 检查历史匹配并过滤
    const filteredCandidates: CandidateUser[] = [];
    const validPairKeys = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const pairKey =
          a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;

        // 跳过历史匹配过的用户对
        const hasPrevMatch = await hasPreviousMatch(client, a.id, b.id);
        if (hasPrevMatch) continue;

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

    let matchResults: MatchResult[] = [];

    // 根据用户池大小选择算法
    if (filteredCandidates.length <= 50) {
      // 小规模用户池：使用 G-S 变体算法
      console.log("Using Gale-Shapley algorithm...");
      matchResults = await runGaleShapleyMatching(
        filteredCandidates,
        weekTag,
        scoreMatrix
      );
    } else {
      // 大规模用户池：分组后使用 Hungarian 算法
      console.log("Using batch matching with Hungarian algorithm...");
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

        const score =
          scoreMatrix.get(pair.leftId)?.get(pair.rightId) ||
          scoreMatrix.get(pair.rightId)?.get(pair.leftId);

        if (!score || score.total < MIN_SCORE_THRESHOLD) continue;

        matchResults.push({
          id: crypto.randomUUID(),
          userAId: pair.leftId,
          userBId: pair.rightId,
          score,
          weekTag,
          status: "pending",
          expiresAt: expiresAtStr,
          createdAt,
        });
      }
    }

    console.log(`Match results: ${matchResults.length} pairs`);

    // 7. 写入匹配结果和报告
    console.log("7. 写入匹配结果...");
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

    // 8. 清空本周 match_pool
    console.log("8. 清空本周匹配池...");
    await client.from("match_pool").delete().eq("week_tag", weekTag);

    // 9. 统计未匹配用户
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
