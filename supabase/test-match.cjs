/**
 * Supabase 匹配调度器测试脚本
 * 用法: node supabase/test-match.cjs [check|invoke]
 */
const { createClient } = require("../O_match/node_modules/@supabase/supabase-js/dist/index.cjs");

const supabaseUrl = "https://skxzyaejsdcjgtipzban.supabase.co";
const supabaseAnonKey = "sb_publishable_DjUIaHatZQHU5Km_4rwmPw_fejcVjIm";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const mode = process.argv[2] || "check";

  if (mode === "check") {
    console.log("=".repeat(60));
    console.log("📊 检查 Supabase 当前状态");
    console.log("=".repeat(60));

    const { data: pool, error: poolErr } = await supabase
      .from("match_pool")
      .select("*");
    console.log(`\nmatch_pool 记录数: ${pool?.length ?? 0}${poolErr ? ` ❌ ${poolErr.message}` : ""}`);
    if (pool?.length > 0) {
      pool.forEach(p => console.log(`  - ${p.user_id?.substring(0,12)}... week:${p.week_tag}`));
    }

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("*");
    console.log(`matches 记录数: ${matches?.length ?? 0}${matchErr ? ` ❌ ${matchErr.message}` : ""}`);
    if (matches?.length > 0) {
      matches.forEach(m => console.log(`  - ${m.id?.substring(0,12)}... ${m.user_a_id?.substring(0,12)}↔${m.user_b_id?.substring(0,12)} rate:${m.match_rate} status:${m.status}`));
    }

    const { data: reports, error: reportErr } = await supabase
      .from("match_reports")
      .select("id, match_id, created_at");
    console.log(`match_reports 记录数: ${reports?.length ?? 0}${reportErr ? ` ❌ ${reportErr.message}` : ""}`);

    const { count: profileCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    console.log(`profiles 记录数: ${profileCount ?? 0}`);

    const { count: ansCount } = await supabase
      .from("questionnaire_answers")
      .select("*", { count: "exact", head: true });
    console.log(`questionnaire_answers 记录数: ${ansCount ?? 0}`);
  }

  if (mode === "invoke") {
    console.log("=".repeat(60));
    console.log("🚀 调用 match-scheduler Edge Function");
    console.log("=".repeat(60));

    const { data, error } = await supabase.functions.invoke("match-scheduler", {
      method: "POST",
    });

    if (error) {
      console.log("❌ 调用失败:", error);
    } else {
      console.log("✅ 调用成功! 返回结果:");
      console.log(JSON.stringify(data, null, 2));
    }
  }

  if (mode === "all") {
    // 先检查，再调用，再检查
    await main_check();
    console.log("\n");
    await main_invoke();
    console.log("\n");
    await main_check();
  }
}

async function main_check() {
  console.log("=".repeat(60));
  console.log("📊 当前状态");
  console.log("=".repeat(60));

  const { data: pool } = await supabase.from("match_pool").select("*");
  console.log(`match_pool: ${pool?.length ?? 0} 条记录`);
  if (pool?.length > 0) pool.forEach(p => console.log(`  - user:${p.user_id?.substring(0,12)}... week:${p.week_tag}`));

  const { data: matches } = await supabase.from("matches").select("*");
  console.log(`matches: ${matches?.length ?? 0} 条记录`);
  if (matches?.length > 0) matches.forEach(m => console.log(`  - match:${m.id?.substring(0,12)}... rate:${m.match_rate} status:${m.status} week:${m.week_tag}`));
}

async function main_invoke() {
  console.log("=".repeat(60));
  console.log("🚀 调用 match-scheduler");
  console.log("=".repeat(60));

  const { data, error } = await supabase.functions.invoke("match-scheduler", {
    method: "POST",
  });

  if (error) {
    console.log("❌ 失败:", error);
  } else {
    console.log("✅ 成功:", JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
