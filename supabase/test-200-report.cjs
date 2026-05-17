const https = require("https");
const fs = require("fs");
const path = require("path");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W20";
const REPORT_DIR = path.join(__dirname, "..", "docs", "test-reports");
const NOW = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

function api(method, pathStr, body) {
  return new Promise((resolve) => {
    const u = new URL(pathStr, BASE);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    https.request(u, { method,
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET, "Content-Type": "application/json" },
      timeout: 60000,
    }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on("error", (e) => { console.log("  err:", e.message); resolve(null); }).end(bodyStr);
  });
}

function invoke(func, body) {
  return new Promise((resolve) => {
    const u = new URL(`${BASE}/functions/v1/${func}`);
    https.request(u, { method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      timeout: 300000,
    }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on("error", (e) => { console.log("  err:", e.message); resolve(null); }).end(JSON.stringify(body));
  });
}

function delUser(id) {
  return new Promise((resolve) => {
    const u = new URL(`/auth/v1/admin/users/${id}`, BASE);
    https.request(u, { method: "DELETE", headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET }, timeout: 15000 },
      (res) => resolve(res.statusCode)
    ).on("error", () => resolve(0)).end();
  });
}

async function main() {
  // ===== 1. 删旧 =====
  console.log("1. 删除旧用户...");
  const usersResp = await api("GET", "/auth/v1/admin/users?per_page=2000");
  const testUsers = (usersResp?.users || []).filter((u) => u.email?.startsWith("test_"));
  console.log(`   ${testUsers.length} 个`);
  for (let i = 0; i < testUsers.length; i += 15) {
    await Promise.all(testUsers.slice(i, i + 15).map(delUser));
    if ((i + 15) % 300 === 0 || i + 15 >= testUsers.length) process.stdout.write(`   ${i + 15}/${testUsers.length}\r`);
  }
  console.log("");
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  // ===== 2. 生成 200 用户 =====
  console.log("2. 生成 200 用户...");
  for (let b = 1; b <= 2; b++) {
    const r = await invoke("test-data-generator", { count: 100 });
    console.log(`   batch ${b}/2: ${r?.createdCount}个, pool:${r?.totalInPool}`);
    if (b < 2) await new Promise((rr) => setTimeout(rr, 2000));
  }

  // ===== 3. 匹配 =====
  console.log("3. 匹配...");
  const t0 = Date.now();
  const match = await invoke("match-scheduler", {});
  const sec = ((Date.now() - t0) / 1000).toFixed(1);

  // ===== 4. 收集数据 =====
  console.log("4. 收集数据...");
  const [matches, reports, profiles] = await Promise.all([
    api("GET", `/rest/v1/matches?select=*&week_tag=eq.${WEEK}&order=match_rate.desc`),
    api("GET", "/rest/v1/match_reports?select=content,match_id"),
    api("GET", "/rest/v1/profiles?select=id,gender,stage&limit=300"),
  ]);

  const rates = matches.map((m) => m.match_rate).filter(Boolean).sort((a, b) => a - b);
  const M = matches.length;
  const U = 200;
  const avg = (rates.reduce((a, b) => a + b, 0) / M).toFixed(1);
  const median = rates[Math.floor(M / 2)];
  const p25 = rates[Math.floor(M * 0.25)];
  const p75 = rates[Math.floor(M * 0.75)];

  // 分布
  const buckets = {};
  for (const r of rates) {
    const k = `${Math.floor(r / 5) * 5}-${Math.floor(r / 5) * 5 + 4}`;
    buckets[k] = (buckets[k] || 0) + 1;
  }

  // 维度平均
  let dimTotals = {};
  let dimCount = 0, hasInterestCount = 0;
  for (const rep of reports) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    if (!c.dimensions) continue;
    dimCount++;
    for (const d of c.dimensions) {
      dimTotals[d.name] = (dimTotals[d.name] || 0) + d.score;
    }
    const im = c.dimensions.find((d) => d.name === "兴趣匹配度");
    if (im && im.score > 0) hasInterestCount++;
  }

  // 统计用户画像
  const genders = {}, stages = {};
  profiles.forEach((p) => { genders[p.gender] = (genders[p.gender] || 0) + 1; stages[p.stage] = (stages[p.stage] || 0) + 1; });

  // ===== 5. 生成报告 =====
  const dimNames = ["价值观契合度", "生活习惯匹配", "性格互补度", "关系期待匹配度", "期望匹配度", "兴趣匹配度"];
  const stageNames = { undergrad_low: "大一大二", undergrad_high: "大三大四", master: "硕士", doctor: "博士" };

  const report = `# 匹配算法测试报告 — 200人（六维 v3）

> 生成时间: ${new Date().toISOString()}
> 测试周: ${WEEK}
> 阈值: 40
> 算法: Gale-Shapley（≤50人） / Hungarian（>50人）

---

## 权重配置

| 维度 | 权重 |
|------|------|
| 价值观契合度 | 20% |
| 生活习惯匹配 | 20% |
| 性格互补度 | 20% |
| 关系期待匹配度 | 15% |
| 期望匹配度 | 15% |
| 兴趣匹配度 | 10% |

---

## 测试规模

| 指标 | 数值 |
|------|------|
| 总用户 | ${U} |
| 性别分布 | 男: ${genders.male}, 女: ${genders.female} |
| 学段分布 | ${Object.entries(stages).map(([k, v]) => `${stageNames[k] || k}: ${v}`).join(", ")} |

---

## 匹配结果

| 指标 | 数值 |
|------|------|
| 总耗时 | ${sec}s |
| 候选人数 | ${match.totalCandidates} |
| 匹配对数 | **${M}** |
| 匹配用户数 | ${M * 2}/${U} (${(M * 2 / U * 100).toFixed(1)}%) |
| 未匹配人数 | ${U - M * 2} |
| 最高分 | ${rates[rates.length - 1]?.toFixed(1)} |
| 最低分 | ${rates[0]?.toFixed(1)} |
| 中位数 | ${median?.toFixed(1)} |
| 平均分 | ${avg} |

### 分数分布

| 分数段 | 匹配数 | 占比 |
|--------|--------|------|
${Object.entries(buckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => `| ${k} | ${v} | ${(v / M * 100).toFixed(0)}% |`).join("\n")}

---

## 六维度平均分

| 维度 | 权重 | 平均分 |
|------|------|--------|
${dimNames.map((n) => `| ${n} | ${n === "兴趣匹配度" ? "10%" : n === "性格互补度" ? "20%" : n === "价值观契合度" || n === "生活习惯匹配" ? "20%" : "15%"} | ${(dimTotals[n] / dimCount).toFixed(1)} |`).join("\n")}

> 兴趣维度有 ${hasInterestCount}/${dimCount} 的报告得分 > 0（${(hasInterestCount / dimCount * 100).toFixed(0)}%）

---

## Top 10 匹配

| # | 匹配率 | 价值观 | 生活习惯 | 性格 | 关系期待 | 期望 | 兴趣 |
|---|--------|--------|---------|------|---------|------|------|
${matches.slice(0, 10).map((m, i) => {
  const rep = reports.find((r) => r.match_id === m.id);
  const c = rep ? (typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content) : null;
  const get = (n) => c?.dimensions?.find((d) => d.name === n)?.score?.toFixed(0) || "-";
  return `| ${i + 1} | ${m.match_rate?.toFixed(1)} | ${get("价值观契合度")} | ${get("生活习惯匹配")} | ${get("性格互补度")} | ${get("关系期待匹配度")} | ${get("期望匹配度")} | ${get("兴趣匹配度")} |`;
}).join("\n")}
`;

  const outPath = path.join(REPORT_DIR, `weights-v3-200-${NOW}.md`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outPath, report);
  console.log(`\n   ✅ 报告: ${outPath}`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
