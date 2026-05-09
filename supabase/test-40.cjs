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
  console.log(`profiles: ${profiles.length} 人`);

  // 只取前 40 个
  const subset = profiles.slice(0, 40);
  console.log(`使用: ${subset.length} 人`);

  // 2. 清空旧 match_pool
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  // 3. 插入 match_pool
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await api("POST", "/rest/v1/match_pool", batch);
  }

  const pool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`match_pool: ${pool[0].count} 人`);

  // 4. 调用 match-scheduler
  console.log("\n🚀 调用 match-scheduler...");
  const invokeResult = await new Promise((resolve, reject) => {
    const url = new URL(`${BASE}/functions/v1/match-scheduler`);
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
    r.write("{}");
    r.end();
  });

  console.log(JSON.stringify(invokeResult, null, 2));

  // 5. 检查 matches
  const matches = await api("GET", `/rest/v1/matches?select=id,user_a_id,user_b_id,match_rate,status&week_tag=eq.${WEEK}`);
  console.log(`\nmatches: ${matches.length} 条`);
  matches.forEach((m) => {
    const a = m.user_a_id?.substring(0, 8) || "?";
    const b = m.user_b_id?.substring(0, 8) || "?";
    console.log(`  rate:${m.match_rate} | ${m.status} | ${a} ↔ ${b}`);
  });

  // 6. 检查 match_reports
  const reports = await api("GET", "/rest/v1/match_reports?select=id,match_id");
  console.log(`\nmatch_reports: ${reports.length} 条`);

  // 7. 验证 pool 是否清空
  const finalPool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`match_pool 剩余: ${finalPool[0].count} 人`);
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1); });
