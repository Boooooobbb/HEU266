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

async function main() {
  const N = parseInt(process.argv[2]) || 100;

  // 1. 清空所有相关数据
  console.log("🧹 清空旧数据...");
  await api("DELETE", `/rest/v1/match_reports?match_id=neq.null`); // 需要在 matches 之前删
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  // 验证清空
  const m = await api("GET", "/rest/v1/matches?select=count&week_tag=eq.${WEEK}");
  const mp = await api("GET", "/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}");
  console.log(`  matches: ${m[0].count}, match_pool: ${mp[0].count}`);

  // 2. 填充 pool
  const profiles = await api("GET", "/rest/v1/profiles?select=id&limit=200");
  const subset = profiles.slice(0, N);
  console.log(`📥 填充 ${subset.length} 人...`);

  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
  }

  // 3. 运行匹配
  console.log("🚀 调用 match-scheduler...");
  const t0 = Date.now();
  const result = await new Promise((resolve, reject) => {
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
    r.on("timeout", () => { r.destroy(); reject(new Error("timeout")); });
    r.write("{}"); r.end();
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (result.code) {
    console.log(`❌ ${result.code}: ${result.message}`);
    return;
  }

  console.log(`✅ 完成 (${elapsed}s)`);
  console.log("");
  console.log("📊 结果:");
  console.log(`   总候选: ${result.totalCandidates}`);
  console.log(`   过滤后: ${result.filteredCandidates}`);
  console.log(`   匹配数: ${result.matchesCreated}`);
  console.log(`   未匹配: ${result.unmatchedCount}`);
  console.log(`   匹配率: ${(result.matchesCreated / result.totalCandidates * 100).toFixed(1)}% 的用户获得了匹配`);

  // 4. 查看匹配详情
  const matches = await api("GET", `/rest/v1/matches?select=id,user_a_id,user_b_id,match_rate,status&week_tag=eq.${WEEK}`);
  console.log(`\n📋 实际 matches: ${matches.length} 条`);
  const rates = matches.map(m => m.match_rate).sort((a,b) => b-a);
  if (rates.length > 0) {
    console.log(`   最高分: ${rates[0]}`);
    console.log(`   最低分: ${rates[rates.length-1]}`);
    console.log(`   中位数: ${rates[Math.floor(rates.length/2)]}`);

    // 分数分布
    const buckets = {"40-44":0,"45-49":0,"50-54":0,"55-59":0,"60+":0};
    for(const r of rates) {
      if(r<45) buckets["40-44"]++;
      else if(r<50) buckets["45-49"]++;
      else if(r<55) buckets["50-54"]++;
      else if(r<60) buckets["55-59"]++;
      else buckets["60+"]++;
    }
    console.log("   分数分布:");
    for(const [k,v] of Object.entries(buckets)) if(v>0) console.log(`     ${k}: ${v}`);

    // 详情
    console.log("\n   匹配详情:");
    matches.forEach((m,i) => {
      const a=m.user_a_id?.substring(0,8), b=m.user_b_id?.substring(0,8);
      console.log(`   #${i+1}: rate=${m.match_rate} | ${a} ↔ ${b}`);
    });
  }

  // 5. 报告
  const reports = await api("GET", "/rest/v1/match_reports?select=id,match_id");
  console.log(`\n📋 match_reports: ${reports.length} 条`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
