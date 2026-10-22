/**
 * Supabase Edge Function: Test Data Generator
 * 生成随机测试用户数据进行匹配算法测试
 * 注意：profiles 表有 auth.users 外键约束，需要通过 signup 创建用户
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getWeekTag(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function generateUserAnswers(userId: string, gender: string) {
  const answers: { user_id: string; module_id: string; question_id: string; answer_value: any }[] = [];

  const expectedGender = choice(["male", "female", "both"]);
  const stage = choice(["undergrad_low", "undergrad_high", "master", "doctor"]);
  const partnerStages = choice([
    ["undergrad_low", "undergrad_high"],
    ["master", "doctor"],
    ["both"],
    ["undergrad_high", "master"]
  ]);
  const locations = choice([
    ["library", "gym"],
    ["cafeteria", "library"],
    ["dormitory", "sports_field"],
    ["library", "sports_field", "dormitory"]
  ]);

  const ALL_INTERESTS = [
    "跳舞💃","篮球🏀","足球⚽","羽毛球🏸","乒乓球🏓","跑步🏃",
    "健身💪","游泳🏊","瑜伽🧘","骑行🚴","滑雪🎿","滑冰⛸️",
    "摄影📷","绘画🎨","音乐🎵","吉他🎸","钢琴🎹","小提琴🎻",
    "阅读📚","写作✍️","电影🎬","动漫🎭","游戏🎮","编程💻",
    "烹饪🍳","烘焙🧁","咖啡☕","旅行✈️","徒步🥾","露营🏕️",
    "滑板🛹","桌游🎲","象棋♟️","剧本杀🔍","密室逃脱🗝️","手工✂️",
    "养宠🐱","种花🌻","看展🏛️","话剧🎭","演唱会🎤","追星🌟",
    "汉服👘","街舞🕺","说唱🎙️","架子鼓🥁","二次元🌸","书法🖌️",
    "钓鱼🎣","攀岩🧗",
  ];
  // 随机选 3-8 个兴趣
  const pickCount = 3 + Math.floor(Math.random() * 6);
  const shuffled = [...ALL_INTERESTS].sort(() => Math.random() - 0.5);
  const interests = shuffled.slice(0, pickCount);

  // Module 1
  answers.push(
    { user_id: userId, module_id: "module_1", question_id: "module_1.gender", answer_value: gender },
    { user_id: userId, module_id: "module_1", question_id: "module_1.expectedGender", answer_value: expectedGender },
    { user_id: userId, module_id: "module_1", question_id: "module_1.stage", answer_value: stage },
    { user_id: userId, module_id: "module_1", question_id: "module_1.partnerStages", answer_value: partnerStages },
    { user_id: userId, module_id: "module_1", question_id: "module_1.locations", answer_value: locations },
    { user_id: userId, module_id: "module_1", question_id: "module_1.interests", answer_value: interests }
  );

  // Module 2
  answers.push(
    { user_id: userId, module_id: "module_2", question_id: "module_2.q1Schedule", answer_value: choice(["early", "flexible", "night"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q1Attitude", answer_value: choice(["A", "B", "C"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q2Space", answer_value: choice(["neat", "chaotic", "casual"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q2Tolerance", answer_value: choice(["A", "B", "C"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q3Frequency", answer_value: choice(["high", "normal", "low"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q3Bottomline", answer_value: choice(["A", "B", "C"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q4Smoking", answer_value: choice(["never", "sometimes", "often"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q4Bottomline", answer_value: choice(["A", "B"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q5Alcohol", answer_value: choice(["never", "sometimes", "often"]) },
    { user_id: userId, module_id: "module_2", question_id: "module_2.q5Bottomline", answer_value: choice(["A", "B"]) }
  );

  // Module 3
  for (let q = 1; q <= 10; q++) {
    answers.push(
      { user_id: userId, module_id: "module_3", question_id: `module_3.q${q}Slider`, answer_value: randInt(0, 4) },
      { user_id: userId, module_id: "module_3", question_id: `module_3.q${q}Preference`, answer_value: choice(["similar", "complement"]) }
    );
  }

  // Module 4
  answers.push(
    { user_id: userId, module_id: "module_4", question_id: "module_4.q1", answer_value: choice(["save", "balance", "enjoy"]) },
    { user_id: userId, module_id: "module_4", question_id: "module_4.q2", answer_value: choice(["clear", "flow", "explore"]) },
    { user_id: userId, module_id: "module_4", question_id: "module_4.q3", answer_value: choice(["task", "balance", "love"]) },
    { user_id: userId, module_id: "module_4", question_id: "module_4.q4", answer_value: choice(["stable", "weigh", "adventure"]) },
    { user_id: userId, module_id: "module_4", question_id: "module_4.q5", answer_value: choice(["clear", "flex", "emotion"]) },
    { user_id: userId, module_id: "module_4", question_id: "module_4.q6", answer_value: choice(["improve", "balance", "relax"]) }
  );

  // Module 5
  answers.push(
    { user_id: userId, module_id: "module_5", question_id: "module_5.q1", answer_value: choice(["secure", "anxious", "avoidant"]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q2", answer_value: choice([["words", "time"], ["gifts", "service"], ["touch", "words"], ["time", "gifts", "touch"]]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q3", answer_value: choice(["boundary", "merge", "balance"]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q4", answer_value: choice(["listen", "analysis", "distract", "alone"]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q5", answer_value: choice(["certainty", "tolerance", "social", "boundary"]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q6", answer_value: choice(["communication", "emotion", "imbalance", "compress"]) },
    { user_id: userId, module_id: "module_5", question_id: "module_5.q7", answer_value: choice([["belonging", "growth"], ["relaxation", "passion"], ["growth", "relaxation"], ["belonging", "passion"]]) }
  );

  return { expectedGender, stage, partnerStages, locations, answers };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const { count = 10, clearExisting = false } = await req.json();
    const weekTag = getWeekTag();

    // 清除现有测试数据（可选）
    if (clearExisting) {
      // 获取本周 match_pool 中的用户
      const { data: poolUsers } = await client
        .from("match_pool")
        .select("user_id")
        .eq("week_tag", weekTag);

      if (poolUsers && poolUsers.length > 0) {
        const userIds = poolUsers.map((p: any) => p.user_id);
        await client.from("matches").delete().eq("week_tag", weekTag);
        await client.from("match_pool").delete().eq("week_tag", weekTag);
        await client.from("questionnaire_answers").in("user_id", userIds);
        // profiles 无法通过 API 删除（FK 约束），需要手动处理
      }
    }

    const createdUsers: { id: string; gender: string; stage: string }[] = [];

    for (let i = 0; i < count; i++) {
      const userId = crypto.randomUUID();
      const gender = choice(["male", "female"]);
      const { expectedGender, stage, partnerStages, locations, answers } = generateUserAnswers(userId, gender);

      // 通过 Admin API 创建 auth.users
      const { data: authUser, error: authError } = await client.auth.admin.createUser({
        id: userId,
        email: `test_${userId.substring(0, 8)}@hrbeu.edu.cn`,
        email_confirm: true,
        user_metadata: { gender }
      });

      if (authError) {
        console.error(`Auth create error:`, authError);
        continue;
      }

      // 创建 profiles（使用刚创建的 auth user ID）
      const { error: profileError } = await client.from("profiles").insert({
        id: userId,
        gender,
        expected_gender: expectedGender,
        stage,
        partner_stages: partnerStages,
        locations,
        questionnaire_completed: true,
      });

      if (profileError) {
        console.error(`Profile error:`, profileError);
        // 继续插入问卷答案
      }

      // 批量插入问卷答案
      if (answers.length > 0) {
        await client.from("questionnaire_answers").insert(answers);
      }

      // 加入匹配池
      await client.from("match_pool").insert({
        user_id: userId,
        week_tag: weekTag,
      });

      createdUsers.push({ id: userId, gender, stage });
      console.log(`  ✓ 用户 ${i + 1}/${count}: ${gender}, ${stage}`);
    }

    // 获取最终统计
    const { data: finalPool } = await client
      .from("match_pool")
      .select("user_id")
      .eq("week_tag", weekTag);

    return new Response(JSON.stringify({
      success: true,
      createdCount: createdUsers.length,
      weekTag,
      totalInPool: finalPool?.length || 0,
      users: createdUsers,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
