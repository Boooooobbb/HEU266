const https = require("https");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W19";

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        apikey: SECRET,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    };
    const r = https.request(opts, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("timeout")); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function main() {
  // 1. 获取所有 profile ID
  const profiles = await api("GET", "/rest/v1/profiles?select=id&limit=200");
  console.log(`1. profiles: ${profiles.length} 人`);

  // 2. 清空旧 match_pool
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);
  console.log("2. 清空旧 match_pool");

  // 3. 批量插入 match_pool
  const rows = profiles.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await api("POST", "/rest/v1/match_pool", batch);
    console.log(`   batch ${i / 50 + 1}: ${batch.length} 条 ✓`);
  }

  // 4. 验证
  const pool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`3. match_pool: ${pool[0].count} 人`);

  // 5. 调用 match-scheduler
  console.log("\n🚀 调用 match-scheduler...");
  const invokeUrl = `${BASE}/functions/v1/match-scheduler`;
  const invokeResult = await new Promise((resolve, reject) => {
    const url = new URL(invokeUrl);
    const bodyStr = "{}";
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
      },
      timeout: 300000,
    };
    const r = https.request(opts, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("timeout")); });
    r.write(bodyStr);
    r.end();
  });

  console.log("\n📊 匹配结果:");
  console.log(JSON.stringify(invokeResult, null, 2));

  // 6. 检查 matches
  const matches = await api("GET", `/rest/v1/matches?select=id,user_a_id,user_b_id,match_rate,status&week_tag=eq.${WEEK}`);
  console.log(`\n📋 matches: ${matches.length} 条`);
  matches.slice(0, 10).forEach((m) =>
    console.log(`  ${m.id.substring(0, 12)} | rate:${m.match_rate} | ${m.status} | A:${m.user_a_id?.substring(0, 12)} B:${m.user_b_id?.substring(0, 12)}`)
  );

  // 7. 检查 match_reports
  const reports = await api("GET", "/rest/v1/match_reports?select=id,match_id,created_at");
  console.log(`\n📋 match_reports: ${reports.length} 条`);
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1); });
