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
  console.log(`\n测试 ${n} 人...`);
  const profiles = await api("GET", "/rest/v1/profiles?select=id&limit=200");
  const subset = profiles.slice(0, n);

  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
  }

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
    console.log(`  ❌ 失败 (${elapsed}s): ${result.error}`);
  } else if (result.code) {
    console.log(`  ❌ 失败 (${elapsed}s): ${result.code} - ${result.message}`);
  } else {
    console.log(`  ✅ 成功 (${elapsed}s): candidates=${result.totalCandidates}, filtered=${result.filteredCandidates}, matches=${result.matchesCreated}, unmatched=${result.unmatchedCount}`);
  }

  const matches = await api("GET", `/rest/v1/matches?select=id,match_rate&week_tag=eq.${WEEK}`);
  if (matches.length > 0) {
    matches.forEach((m) => console.log(`     match: rate=${m.match_rate}`));
  }

  return { n, elapsed, success: !result.error && !result.code, matchCount: matches.length };
}

async function main() {
  const results = [];
  for (const n of [80, 100]) {
    const r = await testScale(n);
    results.push(r);
    await new Promise((res) => setTimeout(res, 2000));
  }
  console.log("\n汇总:");
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.n}人 → ${r.elapsed}s | matches:${r.matchCount}`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
