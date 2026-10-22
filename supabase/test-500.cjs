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
      timeout: 60000,
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
  // Step 1: 检查现有 profiles
  let profiles = await api("GET", "/rest/v1/profiles?select=id&limit=500");
  console.log(`现有 profiles: ${profiles.length} 人`);

  // 需要生成多少额外用户
  const need = 500 - profiles.length;
  if (need > 0) {
    console.log(`Step 1: 生成额外 ${need} 个用户...`);

    // 分批生成，每批50个
    let generated = 0;
    while (generated < need) {
      const batchSize = Math.min(100, need - generated);
      console.log(`  生成 ${batchSize} 个用户...`);

      const genResult = await new Promise((resolve, reject) => {
        const url = new URL(`${BASE}/functions/v1/test-data-generator`);
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
        r.write(JSON.stringify({count: batchSize}));
        r.end();
      });

      if (genResult.code) {
        console.log(`  ❌ 失败: ${genResult.code}`);
        break;
      }
      generated += genResult.createdCount;
      console.log(`  ✅ 已生成 ${generated}/${need}`);

      // 小延迟避免 rate limit
      if (generated < need) await new Promise(r => setTimeout(r, 2000));
    }

    profiles = await api("GET", "/rest/v1/profiles?select=id&limit=600");
    console.log(`总 profiles: ${profiles.length} 人`);
  }

  // Step 2: 清空旧数据
  console.log("\nStep 2: 清空旧数据...");
  await api("DELETE", "/rest/v1/matches?week_tag=eq.${WEEK}");
  await api("DELETE", "/rest/v1/match_pool?week_tag=eq.${WEEK}");

  // Step 3: 填充 500 人到 pool
  console.log("Step 3: 填充 500 人到 match_pool...");
  const subset = profiles.slice(0, 500);
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
    process.stdout.write(`  ${i+1}-${Math.min(i+50, rows.length)}/${rows.length}\r`);
  }
  console.log("");

  // Step 4: 运行匹配
  console.log("Step 4: 🚀 运行 match-scheduler (500人)...");
  console.log("  (预计需要1-3分钟，请耐心等待)");
  const t0 = Date.now();

  const result = await new Promise((resolve, reject) => {
    const url = new URL(`${BASE}/functions/v1/match-scheduler`);
    const opts = {
      hostname: url.hostname, path: url.pathname, method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      timeout: 600000, // 10分钟
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("edge_timeout")); });
    r.write("{}"); r.end();
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (result.code) {
    console.log(`❌ 失败 (${elapsed}s): ${result.code}`);
    return;
  }
  console.log(`✅ 完成 (${elapsed}s)`);

  console.log("\n📊 结果:");
  console.log(`   总候选: ${result.totalCandidates}`);
  console.log(`   过滤后: ${result.filteredCandidates}`);
  console.log(`   匹配数: ${result.matchesCreated}`);
  console.log(`   未匹配: ${result.unmatchedCount}`);

  // 匹配详情
  const matches = await api("GET", `/rest/v1/matches?select=id,match_rate&week_tag=eq.${WEEK}`);
  console.log(`\n📋 实际匹配数: ${matches.length}`);

  if (matches.length > 0) {
    const rates = matches.map(m => m.match_rate).sort((a,b)=>b-a);
    const avg = (rates.reduce((a,b)=>a+b,0)/rates.length).toFixed(1);
    const median = rates[Math.floor(rates.length/2)];
    console.log(`   最高: ${rates[0]}, 中位数: ${median}, 最低: ${rates[rates.length-1]}, 平均: ${avg}`);

    const buckets = {"40-44":0,"45-49":0,"50-54":0,"55-59":0,"60-64":0,"65+":0};
    for(const r of rates) {
      if(r<45) buckets["40-44"]++;
      else if(r<50) buckets["45-49"]++;
      else if(r<55) buckets["50-54"]++;
      else if(r<60) buckets["55-59"]++;
      else if(r<65) buckets["60-64"]++;
      else buckets["65+"]++;
    }
    console.log("   分数分布:");
    for(const [k,v] of Object.entries(buckets)) if(v>0) console.log(`     ${k}: ${v} (${(v/matches.length*100).toFixed(0)}%)`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
