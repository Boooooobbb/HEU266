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
  const testSize = parseInt(process.argv[2]) || 80;
  console.log(`测试规模: ${testSize} 人\n`);

  const profiles = await api("GET", "/rest/v1/profiles?select=id,gender&limit=200");
  console.log(`总 profiles: ${profiles.length} 人`);
  const subset = profiles.slice(0, testSize);
  const m = subset.filter((p) => p.gender === "male").length;
  const f = subset.filter((p) => p.gender === "female").length;
  console.log(`  男:${m} 女:${f}`);

  // 清空旧 pool
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  // 插入
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
  }
  const pool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`match_pool: ${pool[0].count} 人`);

  // 调用
  console.log("🚀 调用 match-scheduler...");
  const t0 = Date.now();
  const invokeResult = await new Promise((resolve, reject) => {
    const url = new URL(`${BASE}/functions/v1/match-scheduler`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
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
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (invokeResult.code) {
    console.log(`❌ 失败 (${elapsed}s): ${invokeResult.code} - ${invokeResult.message}`);
  } else {
    console.log(`✅ 成功 (${elapsed}s):`);
    console.log(`   总候选: ${invokeResult.totalCandidates}, 匹配: ${invokeResult.matchesCreated}, 未匹配: ${invokeResult.unmatchedCount}`);
  }

  // 检查结果
  const matches = await api("GET", `/rest/v1/matches?select=id,match_rate,status&week_tag=eq.${WEEK}`);
  console.log(`\nmatches: ${matches.length} 条`);
  matches.forEach((m) => console.log(`  rate:${m.match_rate} | ${m.status}`));

  const reports = await api("GET", "/rest/v1/match_reports?select=id,match_id");
  console.log(`match_reports: ${reports.length} 条`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
