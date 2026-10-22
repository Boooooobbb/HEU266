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
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET, "Content-Type": "application/json" },
      timeout: 30000,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("timeout")); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function testScale(n) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`测试规模: ${n} 人`);
  console.log(`${"═".repeat(50)}`);

  // 获取 profiles
  const profiles = await api("GET", "/rest/v1/profiles?select=id,gender&limit=200");
  const subset = profiles.slice(0, n);

  // 清空 + 填充
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
  }

  const pool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`match_pool: ${pool[0].count} 人`);

  // 调用
  const t0 = Date.now();
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const url = new URL(`${BASE}/functions/v1/match-scheduler`);
      const opts = {
        hostname: url.hostname, path: url.pathname, method: "POST",
        headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
        timeout: 300000,
      };
      const r = https.request(opts, (res) => {
        let b = ""; res.on("data", (c) => (b += c));
        res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
      });
      r.on("error", reject);
      r.on("timeout", () => { r.destroy(); reject(new Error("edge_timeout")); });
      r.write("{}"); r.end();
    });
  } catch (e) {
    result = { error: e.message };
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (result.error) {
    console.log(`❌ 失败 (${elapsed}s): ${result.error}`);
  } else if (result.code) {
    console.log(`❌ 失败 (${elapsed}s): ${result.code}`);
  } else {
    console.log(`✅ 成功 (${elapsed}s): candidates=${result.totalCandidates}, matches=${result.matchesCreated}, unmatched=${result.unmatchedCount}`);
  }

  // 检查实际 matches
  const matches = await api("GET", `/rest/v1/matches?select=id,match_rate&week_tag=eq.${WEEK}`);
  console.log(`  实际 matches 数: ${matches.length}`);

  // 检查 pool 剩余
  const finalPool = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);
  console.log(`  剩余 match_pool: ${finalPool[0].count} 人`);

  return { n, result, elapsed, matchCount: matches.length };
}

async function main() {
  console.log("🔍 找到 match-scheduler 的最大可用规模\n");

  const results = [];
  for (const n of [30, 40, 50, 60]) {
    const r = await testScale(n);
    results.push(r);
    if (r.result.error || r.result.code) break;
    // 等待一下避免 rate limit
    await new Promise((res) => setTimeout(res, 3000));
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("汇总:");
  for (const r of results) {
    const status = r.result.error || r.result.code ? "❌" : "✅";
    console.log(`  ${status} ${r.n}人 → ${r.elapsed}s | matches:${r.matchCount}`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
