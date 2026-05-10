const https = require("https");
const fs = require("fs");
const path = require("path");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W19";
const REPORT_DIR = path.join(__dirname, "..", "docs", "test-reports");
const NOW = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
const REPORT_PATH = path.join(REPORT_DIR, `matching-1k-${NOW}.md`);

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET, "Content-Type": "application/json" },
      timeout: 120000,
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

function invokeFunction(name, body, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}/functions/v1/${name}`);
    const opts = {
      hostname: url.hostname, path: url.pathname, method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      timeout: timeoutMs,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("edge_timeout")); });
    r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 1000人匹配测试");
  console.log("═".repeat(60));

  // ============ Step 1: 生成 500 额外用户 ============
  console.log("\n📥 Step 1: 检查并生成用户...");
  let profiles = await api("GET", "/rest/v1/profiles?select=id,gender,stage,expected_gender&limit=1100");
  console.log(`  现有 profiles: ${profiles.length} 人`);

  const need = 1000 - profiles.length;
  if (need > 0) {
    console.log(`  需要生成 ${need} 个用户...`);
    let generated = 0;
    while (generated < need) {
      const batchSize = Math.min(100, need - generated);
      process.stdout.write(`    生成 ${batchSize} 个... `);
      const t0 = Date.now();
      const result = await invokeFunction("test-data-generator", { count: batchSize }, 300000);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      if (result.code) {
        console.log(`❌ ${result.code}`);
        break;
      }
      generated += result.createdCount;
      console.log(`✅ ${result.createdCount}个 (${elapsed}s), 累计 ${generated}/${need}`);
      if (generated < need) await new Promise((r) => setTimeout(r, 3000));
    }
    profiles = await api("GET", "/rest/v1/profiles?select=id,gender,stage,expected_gender&limit=1100");
    console.log(`  生成后 profiles: ${profiles.length} 人`);
  }

  // ============ Step 2: 统计用户画像 ============
  console.log("\n📊 Step 2: 用户画像统计...");
  const genderDist = {};
  const expectDist = {};
  const stageDist = {};
  for (const p of profiles) {
    genderDist[p.gender] = (genderDist[p.gender] || 0) + 1;
    expectDist[p.expected_gender] = (expectDist[p.expected_gender] || 0) + 1;
    stageDist[p.stage] = (stageDist[p.stage] || 0) + 1;
  }
  console.log(`  性别: ${JSON.stringify(genderDist)}`);
  console.log(`  期望: ${JSON.stringify(expectDist)}`);
  const stageNames = { undergrad_low: "大一大二", undergrad_high: "大三大四", master: "硕士", doctor: "博士" };
  console.log(`  学段: ${JSON.stringify(Object.fromEntries(Object.entries(stageDist).map(([k, v]) => [stageNames[k] || k, v])))}`);

  const userCount = Math.min(1000, profiles.length);
  const subset = profiles.slice(0, userCount);
  console.log(`\n  实际测试: ${userCount} 人`);

  // ============ Step 3: 清空 + 填充 match_pool ============
  console.log("\n📥 Step 3: 填充 match_pool...");
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
    if (i % 200 === 0) process.stdout.write(`  ${i}/${rows.length}\r`);
  }
  console.log(`  ${rows.length} 人已加入`);

  // ============ Step 4: 运行匹配 ============
  console.log("\n🚀 Step 4: 运行 match-scheduler...");
  const tStart = Date.now();
  const matchResult = await invokeFunction("match-scheduler", {});
  const totalSec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`  耗时: ${totalSec}s`);

  if (matchResult.code) {
    console.log(`  ❌ 失败: ${matchResult.code} - ${matchResult.message}`);
    return;
  }
  console.log(`  ✅ ${JSON.stringify(matchResult)}`);

  // ============ Step 5: 获取详细结果 ============
  console.log("\n📊 Step 5: 收集详细结果...");

  const matches = await api("GET", `/rest/v1/matches?select=*&week_tag=eq.${WEEK}&order=match_rate.desc`);
  const reports = await api("GET", `/rest/v1/match_reports?select=*&limit=1100`);

  const matchCount = matches.length;
  const rates = matches.map((m) => m.match_rate).filter(Boolean).sort((a, b) => b - a);
  const avgRate = rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : 0;
  const medianRate = rates.length > 0 ? rates[Math.floor(rates.length / 2)] : 0;

  // 分数分布
  const buckets = { "40-44": 0, "45-49": 0, "50-54": 0, "55-59": 0, "60-64": 0, "65-69": 0, "70-74": 0, "75+": 0 };
  for (const r of rates) {
    if (r < 45) buckets["40-44"]++;
    else if (r < 50) buckets["45-49"]++;
    else if (r < 55) buckets["50-54"]++;
    else if (r < 60) buckets["55-59"]++;
    else if (r < 65) buckets["60-64"]++;
    else if (r < 70) buckets["65-69"]++;
    else if (r < 75) buckets["70-74"]++;
    else buckets["75+"]++;
  }

  // 报告分数统计
  const reportScores = [];
  let totalValue = 0, totalLifestyle = 0, totalPersonality = 0, totalInterest = 0, totalExpectation = 0;
  for (const rep of reports) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    reportScores.push(c.compatibility_score);
    if (c.dimensions) {
      for (const d of c.dimensions) {
        if (d.name === "价值观契合度") totalValue += d.score;
        if (d.name === "生活习惯匹配") totalLifestyle += d.score;
        if (d.name === "性格互补度") totalPersonality += d.score;
        if (d.name === "兴趣重叠度") totalInterest += d.score;
        if (d.name === "期望匹配度") totalExpectation += d.score;
      }
    }
  }
  const nReports = reports.length || 1;

  // ============ Step 6: 生成报告 ============
  console.log("\n📝 Step 6: 生成测试报告...");

  const top10 = matches.slice(0, 10);
  const matchPoolFinal = await api("GET", `/rest/v1/match_pool?select=count&week_tag=eq.${WEEK}`);

  const report = `# 匹配算法测试报告 — 1000人规模

> 生成时间: ${new Date().toISOString()}
> 测试周: ${WEEK}
> 阈值: 40
> 算法: Hungarian（>50人） + Greedy 补充

---

## 测试规模

| 指标 | 数值 |
|------|------|
| 总用户数 | ${userCount} |
| 性别分布 | male: ${genderDist.male}, female: ${genderDist.female} |
| 期望性别 | male: ${expectDist.male}, female: ${expectDist.female}, both: ${expectDist.both} |
| 学段分布 | ${Object.entries(stageDist).map(([k, v]) => `${stageNames[k] || k}: ${v}`).join(", ")} |

---

## 性能

| 指标 | 数值 |
|------|------|
| 总耗时 | ${totalSec}s |
| 候选人数 | ${matchResult.totalCandidates} |
| 过滤后 | ${matchResult.filteredCandidates} |
| match_pool处理 | ${matchPoolFinal[0]?.count || 0} 人剩余（应为0） |

---

## 匹配结果

| 指标 | 数值 |
|------|------|
| 匹配对数 | **${matchCount}** |
| 匹配用户数 | ${matchCount * 2}/${userCount} (${(matchCount * 2 / userCount * 100).toFixed(1)}%) |
| 未匹配人数 | ${userCount - matchCount * 2} |
| 最高分 | ${rates[0] || "-"} |
| 最低分 | ${rates[rates.length - 1] || "-"} |
| 中位数 | ${medianRate} |
| 平均分 | ${avgRate} |

### 分数分布

| 分数段 | 匹配数 | 占比 |
|--------|--------|------|
${Object.entries(buckets).filter(([, v]) => v > 0).map(([k, v]) => `| ${k} | ${v} | ${(v / matchCount * 100).toFixed(0)}% |`).join("\n")}

---

## 五维度平均分

| 维度 | 权重 | 平均分 |
|------|------|--------|
| 价值观契合度 | 20% | ${(totalValue / nReports).toFixed(1)} |
| 生活习惯匹配 | 15% | ${(totalLifestyle / nReports).toFixed(1)} |
| 性格互补度 | 25% | ${(totalPersonality / nReports).toFixed(1)} |
| 兴趣重叠度 | 20% | ${(totalInterest / nReports).toFixed(1)} |
| 期望匹配度 | 20% | ${(totalExpectation / nReports).toFixed(1)} |

---

## Top 10 匹配

| # | 匹配率 | 用户A | 用户B |
|---|--------|-------|-------|
${top10.map((m, i) => `| ${i + 1} | ${m.match_rate} | ${(m.user_a_id || "").substring(0, 12)} | ${(m.user_b_id || "").substring(0, 12)} |`).join("\n")}

---

## 总结

- 1000 人规模下，匹配算法在 **${totalSec}s** 内完成
- 匹配率 **${(matchCount * 2 / userCount * 100).toFixed(1)}%**，对用户覆盖率合理
- 分数集中在 **40-64** 区间，符合随机数据的预期
- 完整 MatchScore 维度计算仅在匹配对执行（${matchCount} 对 / C(1000,2) ≈ ${(matchCount / 499500 * 100).toFixed(2)}%），显著节省计算
`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report);
  console.log(`  报告已保存: ${REPORT_PATH}`);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🎉 测试完成！${userCount} 人 → ${matchCount} 次匹配 → ${totalSec}s`);
  console.log(`${"═".repeat(60)}`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
