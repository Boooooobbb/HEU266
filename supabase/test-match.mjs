/**
 * Supabase 匹配调度器测试脚本
 * 用法: node supabase/test-match.mjs
 */
import { createClient } from "../O_match/node_modules/@supabase/supabase-js/dist/main/index.js";

const supabaseUrl = "https://skxzyaejsdcjgtipzban.supabase.co";
const supabaseAnonKey = "sb_publishable_DjUIaHatZQHU5Km_4rwmPw_fejcVjIm";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const mode = process.argv[2] || "check";

  if (mode === "check") {
    // 1. 检查当前 match_pool 状态
    console.log("=".repeat(60));
    console.log("📊 检查当前状态");
    console.log("=".repeat(60));

    const { data: pool, error: poolErr } = await supabase
      .from("match_pool")
      .select("*");
    console.log(`match_pool 记录数: ${pool?.length ?? 0}`, poolErr ? `❌ ${poolErr.message}` : "");
    if (pool?.length > 0) console.log("  Pool:", JSON.stringify(pool, null, 2));

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("*");
    console.log(`matches 记录数: ${matches?.length ?? 0}`, matchErr ? `❌ ${matchErr.message}` : "");

    const { data: reports, error: reportErr } = await supabase
      .from("match_reports")
      .select("*");
    console.log(`match_reports 记录数: ${reports?.length ?? 0}`, reportErr ? `❌ ${reportErr.message}` : "");

    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    console.log(`profiles 记录数: ${count ?? 0}`);

    const { count: ansCount } = await supabase
      .from("questionnaire_answers")
      .select("*", { count: "exact", head: true });
    console.log(`questionnaire_answers 记录数: ${ansCount ?? 0}`);
  }

  if (mode === "invoke") {
    // 2. 调用 match-scheduler
    console.log("=".repeat(60));
    console.log("🚀 调用 match-scheduler Edge Function");
    console.log("=".repeat(60));

    const { data, error } = await supabase.functions.invoke("match-scheduler", {
      method: "POST",
    });

    if (error) {
      console.log("❌ 调用失败:", error);
    } else {
      console.log("✅ 调用成功!");
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

main().catch(console.error);
