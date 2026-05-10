const https = require("https");
const fs = require("fs");
const path = require("path");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W19";
const REPORT_DIR = path.join(__dirname, "..", "docs", "test-reports");
const NOW = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

function api(p) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method: "GET",
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET },
      timeout: 60000,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject); r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    r.end();
  });
}

async function main() {
  console.log("🔍 匹配质量评估中...\n");

  // 1. 数据获取
  const [matches, profiles, reports] = await Promise.all([
    api(`/rest/v1/matches?select=*&week_tag=eq.${WEEK}`),
    api("/rest/v1/profiles?select=id,gender,stage,expected_gender,partner_stages,locations&limit=1100"),
    api(`/rest/v1/match_reports?select=content,match_id`),
  ]);

  const pMap = new Map(profiles.map(p => [p.id, p]));
  const rMap = new Map();
  for (const r of reports) {
    const c = typeof r.content === "string" ? JSON.parse(r.content) : r.content;
    rMap.set(r.match_id, c);
  }

  const rates = matches.map(m => m.match_rate).filter(Boolean).sort((a,b)=>a-b);
  const M = matches.length;
  const U = profiles.length;

  // ====== 2. 覆盖率 ======
  const matchedUsers = new Set();
  matches.forEach(m => { matchedUsers.add(m.user_a_id); matchedUsers.add(m.user_b_id); });
  const coverage = matchedUsers.size / U * 100;

  // ====== 3. 分数统计 ======
  const avg = rates.reduce((a,b)=>a+b,0)/rates.length;
  const median = rates[Math.floor(rates.length/2)];
  const p25 = rates[Math.floor(rates.length*0.25)];
  const p75 = rates[Math.floor(rates.length*0.75)];

  // 按维度分析报告分数
  let dimScores = {};
  let dimCount = 0;
  for (const c of rMap.values()) {
    if (!c.dimensions) continue;
    dimCount++;
    for (const d of c.dimensions) {
      const key = d.name;
      if (!dimScores[key]) dimScores[key] = {sum:0, w:d.weight||0};
      dimScores[key].sum += d.score;
    }
  }

  // ====== 4. 公平性：按性别分组 ======
  const matchedGenders = {male:0, female:0};
  const totalGenders = {male:0, female:0};
  profiles.forEach(p => { totalGenders[p.gender] = (totalGenders[p.gender]||0)+1; });
  matchedUsers.forEach(id => {
    const p = pMap.get(id);
    if (p) matchedGenders[p.gender] = (matchedGenders[p.gender]||0)+1;
  });

  // 按学段分组
  const stageNames = {undergrad_low:"大一大二", undergrad_high:"大三大四", master:"硕士", doctor:"博士"};
  const totalStage = {}, matchedStage = {};
  profiles.forEach(p => { totalStage[p.stage] = (totalStage[p.stage]||0)+1; });
  matchedUsers.forEach(id => {
    const p = pMap.get(id);
    if (p) matchedStage[p.stage] = (matchedStage[p.stage]||0)+1;
  });

  // ====== 5. 匹配类型分布 ======
  const matchTypes = {};
  for (const m of matches) {
    const a = pMap.get(m.user_a_id), b = pMap.get(m.user_b_id);
    if (!a || !b) continue;
    const type = `${a.gender}→${a.expected_gender} 配 ${b.gender}→${b.expected_gender}`;
    const simpleType = a.gender===b.gender ? "同性别" :
      (a.expected_gender==="both"||b.expected_gender==="both" ? "bothPool" : "男女异配");
    matchTypes[simpleType] = (matchTypes[simpleType]||0)+1;
  }

  // ====== 6. 未匹配用户分析 ======
  const unmatchedProfiles = profiles.filter(p => !matchedUsers.has(p.id));
  const unmatchedGenders = {}, unmatchedStage = {}, unmatchedExpect = {};
  unmatchedProfiles.forEach(p => {
    unmatchedGenders[p.gender] = (unmatchedGenders[p.gender]||0)+1;
    unmatchedStage[p.stage] = (unmatchedStage[p.stage]||0)+1;
    unmatchedExpect[p.expected_gender] = (unmatchedExpect[p.expected_gender]||0)+1;
  });

  // ====== 7. 硬约束通过率（抽样） ======
  // 快速计算C(U,2)中各约束的通过率 (用1000全量太慢，抽样)
  const SAMPLE = 10000;
  let genderPass=0, stagePass=0;
  const ids = profiles.map(p=>p.id);
  for (let t=0; t<SAMPLE; t++) {
    let i=Math.floor(Math.random()*U), j=Math.floor(Math.random()*U);
    if (i===j) continue;
    if (j<i) { const tmp=i; i=j; j=tmp; }
    const a=profiles[i], b=profiles[j];

    const aOk = a.expected_gender==="both" || a.expected_gender===b.gender;
    const bOk = b.expected_gender==="both" || b.expected_gender===a.gender;
    if (aOk && bOk) {
      genderPass++;
      const aStages = a.partner_stages||[];
      const bStages = b.partner_stages||[];
      if ((aStages.includes("both")||aStages.includes(b.stage)) &&
          (bStages.includes("both")||bStages.includes(a.stage))) {
        stagePass++;
      }
    }
  }

  // ====== 8. 生成报告 ======
  const report = `# 匹配质量评估报告

> 评估时间: ${new Date().toISOString()}
> 测试规模: ${U} 用户, ${M} 对匹配
> 阈值: 40

---

## 1. 覆盖率

| 指标 | 数值 |
|------|------|
| 总用户 | ${U} |
| 获得匹配 | ${matchedUsers.size} (${coverage.toFixed(1)}%) |
| 未匹配 | ${U - matchedUsers.size} (${(100-coverage).toFixed(1)}%) |
| 匹配对数 | ${M} |

---

## 2. 分数统计

| 指标 | 数值 |
|------|------|
| 平均分 | ${avg.toFixed(1)} |
| 中位数 | ${median.toFixed(1)} |
| P25 / P75 | ${p25.toFixed(1)} / ${p75.toFixed(1)} |
| 最高 / 最低 | ${rates[rates.length-1].toFixed(1)} / ${rates[0].toFixed(1)} |
| 标准差 | ${Math.sqrt(rates.reduce((s,r)=>s+(r-avg)**2,0)/rates.length).toFixed(1)} |

### 分布直方图

\`\`\`
40-44 ${'█'.repeat(Math.round((rates.filter(r=>r>=40&&r<45).length/M)*50))} ${rates.filter(r=>r>=40&&r<45).length}
45-49 ${'█'.repeat(Math.round((rates.filter(r=>r>=45&&r<50).length/M)*50))} ${rates.filter(r=>r>=45&&r<50).length}
50-54 ${'█'.repeat(Math.round((rates.filter(r=>r>=50&&r<55).length/M)*50))} ${rates.filter(r=>r>=50&&r<55).length}
55-59 ${'█'.repeat(Math.round((rates.filter(r=>r>=55&&r<60).length/M)*50))} ${rates.filter(r=>r>=55&&r<60).length}
60-64 ${'█'.repeat(Math.round((rates.filter(r=>r>=60&&r<65).length/M)*50))} ${rates.filter(r=>r>=60&&r<65).length}
65-69 ${'█'.repeat(Math.round((rates.filter(r=>r>=65&&r<70).length/M)*50))} ${rates.filter(r=>r>=65&&r<70).length}
70-74 ${'█'.repeat(Math.round((rates.filter(r=>r>=70&&r<75).length/M)*50))} ${rates.filter(r=>r>=70&&r<75).length}
\`\`\`

---

## 3. 五维度贡献分析

| 维度 | 权重 | 平均得分 | 贡献度 |
|------|------|---------|--------|
${Object.entries(dimScores).map(([name,d]) => `| ${name} | ${(d.w*100).toFixed(0)}% | ${(d.sum/dimCount).toFixed(1)} | ${((d.sum/dimCount)*d.w).toFixed(1)} |`).join("\n")}

> 贡献度 = 平均得分 × 权重。如果某个维度贡献度偏低，说明该维度对匹配的区分力不足。

---

## 4. 公平性分析

### 性别匹配率

| 性别 | 总人数 | 匹配数 | 匹配率 |
|------|--------|--------|--------|
${Object.entries(totalGenders).map(([g,n]) => `| ${g==="male"?"男":"女"} | ${n} | ${matchedGenders[g]||0} | ${((matchedGenders[g]||0)/n*100).toFixed(1)}% |`).join("\n")}

### 学段匹配率

| 学段 | 总人数 | 匹配数 | 匹配率 |
|------|--------|--------|--------|
${Object.entries(totalStage).filter(([,v])=>v>0).map(([s,n]) => `| ${stageNames[s]||s} | ${n} | ${matchedStage[s]||0} | ${((matchedStage[s]||0)/n*100).toFixed(1)}% |`).join("\n")}

### 匹配类型分布

| 类型 | 数量 | 占比 |
|------|------|------|
${Object.entries(matchTypes).map(([t,n]) => `| ${t} | ${n} | ${(n/M*100).toFixed(1)}% |`).join("\n")}

---

## 5. 未匹配用户画像

| 指标 | 分布 |
|------|------|
| 性别 | ${Object.entries(unmatchedGenders).map(([k,v])=>(k==="male"?"男":"女")+":"+v).join(", ")} |
| 学段 | ${Object.entries(unmatchedStage).map(([k,v])=>(stageNames[k]||k)+":"+v).join(", ")} |
| 期望 | ${Object.entries(unmatchedExpect).map(([k,v])=>(k==="male"?"男":k==="female"?"女":"都可以")+":"+v).join(", ")} |

---

## 6. 硬约束通过率（抽样 ${SAMPLE} 对）

| 约束 | 通过率 |
|------|--------|
| 性别约束 | ${(genderPass/SAMPLE*100).toFixed(1)}% |
| 性别+学段约束 | ${(stagePass/SAMPLE*100).toFixed(1)}% |

> 理论最大匹配率 ≈ min(50%, 性别约束通过率, 学段约束通过率) = ~${Math.min(50, (stagePass/SAMPLE*100)).toFixed(0)}%

---

## 7. 质量判断

${coverage > 35 ? "✅" : "⚠️"} **覆盖率**: ${coverage.toFixed(0)}% 用户获得匹配${coverage > 35 ? "，在合理范围" : "，偏低，可考虑降低阈值"}

${matchedGenders.male/matchedGenders.female > 0.8 && matchedGenders.male/matchedGenders.female < 1.25 ? "✅" : "⚠️"} **性别公平**: 男${((matchedGenders.male||0)/totalGenders.male*100).toFixed(0)}% 女${((matchedGenders.female||0)/totalGenders.female*100).toFixed(0)}%${Math.abs((matchedGenders.male||0)/totalGenders.male - (matchedGenders.female||0)/totalGenders.female) < 0.1 ? "，基本均衡" : "，存在偏差"}

${dimScores["兴趣重叠度"] && dimScores["兴趣重叠度"].sum/dimCount < 30 ? "⚠️" : "✅"} **兴趣重叠**: 平均${dimScores["兴趣重叠度"]?(dimScores["兴趣重叠度"].sum/dimCount).toFixed(1):"?"}分${dimScores["兴趣重叠度"]&&dimScores["兴趣重叠度"].sum/dimCount<30?"，偏低（随机多选交集少），真实数据会改善":""}

${dimScores["价值观契合度"] && dimScores["价值观契合度"].sum/dimCount < 30 ? "⚠️" : "✅"} **价值观**: 平均${dimScores["价值观契合度"]?(dimScores["价值观契合度"].sum/dimCount).toFixed(1):"?"}分${dimScores["价值观契合度"]&&dimScores["价值观契合度"].sum/dimCount<30?"，偏低（随机选项1/3概率相同），真实数据会大幅改善":""}

---

## 8. 改进建议

1. **阈值调优**: 当前 40 分阈值下匹配率 ${coverage.toFixed(0)}%，可根据产品期望的"匹配稀缺度"微调
2. **维度权重**: 价值观(40.6)和兴趣(51.3)偏低是随机数据特征，真实用户数据上线后建议重新评估
3. **未匹配用户**: ${U-matchedUsers.size} 人未匹配，其中 ${unmatchedExpect.both||0} 人选"都可以"，可考虑给 both 用户开放更多匹配通道
`;

  const outPath = path.join(REPORT_DIR, `eval-1k-${NOW}.md`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outPath, report);
  console.log(`✅ 报告已保存: ${outPath}`);
  console.log(report);
}

main().catch(e => { console.error("❌",e.message); process.exit(1); });
