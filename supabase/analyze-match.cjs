const https = require("https");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";

function api(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method: "GET",
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET },
      timeout: 30000,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.end();
  });
}

function mapToObj(map) {
  const obj = {};
  for (const [k, v] of map) obj[k] = v;
  return obj;
}

async function main() {
  // 1. 获取所有 profile 数据
  const profiles = await api("/rest/v1/profiles?select=*&limit=200");
  console.log(`\n📊 分析了 ${profiles.length} 个用户\n`);

  // 2. 性别分布
  const byGender = {};
  for (const p of profiles) byGender[p.gender] = (byGender[p.gender] || 0) + 1;
  console.log("=== 1. 性别分布 ===");
  console.log(`   男(male): ${byGender.male}, 女(female): ${byGender.female}`);

  // 3. 期望性别分布
  const byExpect = {};
  for (const p of profiles) byExpect[p.expected_gender] = (byExpect[p.expected_gender] || 0) + 1;
  console.log("\n=== 2. 期望性别分布 ===");
  for (const [k, v] of Object.entries(byExpect)) console.log(`   ${k}: ${v}`);

  // 4. 偏好分组（对应 G-S 算法中的分组）
  const malePrefF = profiles.filter(p => p.gender === "male" && (p.expected_gender === "female" || p.expected_gender === "both"));
  const femalePrefM = profiles.filter(p => p.gender === "female" && (p.expected_gender === "male" || p.expected_gender === "both"));
  const maleOnlyF = profiles.filter(p => p.gender === "male" && p.expected_gender === "female");
  const femaleOnlyM = profiles.filter(p => p.gender === "female" && p.expected_gender === "male");
  const bothPool = profiles.filter(p => p.expected_gender === "both");

  console.log("\n=== 3. 偏好分组 ===");
  console.log(`   male→female (or both): ${malePrefF.length}`);
  console.log(`     其中只要female: ${maleOnlyF.length}`);
  console.log(`   female→male (or both): ${femalePrefM.length}`);
  console.log(`     其中只要male: ${femaleOnlyM.length}`);
  console.log(`   bothPool: ${bothPool.length}`);

  // 5. 学段分布
  const byStage = {};
  for (const p of profiles) byStage[p.stage] = (byStage[p.stage] || 0) + 1;
  console.log("\n=== 4. 学段分布 ===");
  for (const [k, v] of Object.entries(byStage)) {
    const label = {undergrad_low:'大一大二',undergrad_high:'大三大四',master:'硕士',doctor:'博士'}[k]||k;
    console.log(`   ${label}(${k}): ${v}`);
  }

  // 6. 计算有多少配对能过性别约束
  let genderPass = 0, genderTotal = 0;
  let stagePass = 0, bothPass = 0;
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i], b = profiles[j];
      genderTotal++;

      // 性别约束
      const aAcceptsB = a.expected_gender === "both" || a.expected_gender === b.gender;
      const bAcceptsA = b.expected_gender === "both" || b.expected_gender === a.gender;
      if (!aAcceptsB || !bAcceptsA) continue;
      genderPass++;

      // 学段约束
      const aStages = a.partner_stages || [];
      const bStages = b.partner_stages || [];
      const aAcceptsBStage = aStages.includes("both") || aStages.includes(b.stage);
      const bAcceptsAStage = bStages.includes("both") || bStages.includes(a.stage);
      if (!aAcceptsBStage || !bAcceptsAStage) continue;
      stagePass++;
    }
  }
  console.log("\n=== 5. 约束通过率 (100人中所有C(100,2)=4950对) ===");
  console.log(`   总配对数: ${genderTotal}`);
  console.log(`   通过性别约束: ${genderPass} (${(genderPass/genderTotal*100).toFixed(1)}%)`);
  console.log(`   通过性别+学段约束: ${stagePass} (${(stagePass/genderTotal*100).toFixed(1)}%)`);

  // 7. 问卷数据统计 - 获取所有答案，分析避雷触发率
  // 先取几个用户看看问卷数据
  const sampleIds = profiles.slice(0, 30).map(p => p.id);

  // 查询 module2 的答案
  const allQA = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const batch = await api(`/rest/v1/questionnaire_answers?select=user_id,module_id,question_id,answer_value&limit=1000&offset=${offset}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allQA.push(...batch);
  }

  // 按用户分组 module2 答案
  const userMod2 = new Map();
  for (const a of allQA) {
    if (a.module_id !== "module_2") continue;
    if (!userMod2.has(a.user_id)) userMod2.set(a.user_id, {});
    const qKey = a.question_id.split(".")[1];
    userMod2.get(a.user_id)[qKey] = a.answer_value;
  }

  // 分析 module2 各维度的分布
  const dimDist = {
    q1Schedule: {}, q1Attitude: {},
    q2Space: {}, q2Tolerance: {},
    q3Frequency: {}, q3Bottomline: {},
    q4Smoking: {}, q4Bottomline: {},
    q5Alcohol: {}, q5Bottomline: {},
  };
  for (const [, m2] of userMod2) {
    for (const [key, val] of Object.entries(m2)) {
      if (dimDist[key]) dimDist[key][val] = (dimDist[key][val] || 0) + 1;
    }
  }

  console.log("\n=== 6. Module 2 避雷态度分布 (红线='A', 有条件='B', 无所谓='C') ===");
  console.log("  作息态度(A=必须同频):", dimDist.q1Attitude);
  console.log("  空间态度(A=必须同频):", dimDist.q2Tolerance);
  console.log("  消息频率底线(A=不能意念回复 B=不能高频):", dimDist.q3Bottomline);
  console.log("  抽烟底线(A=绝对不抽):", dimDist.q4Bottomline);
  console.log("  饮酒底线(A=绝对不喝):", dimDist.q5Bottomline);

  // 红线比例
  const totalUsers = userMod2.size;
  const redlineRate = (key) => {
    const dist = dimDist[key] || {};
    const aCount = dist["A"] || 0;
    return `${aCount}/${totalUsers} (${(aCount/totalUsers*100).toFixed(0)}%)`;
  };
  console.log("\n=== 7. 绝对红线(A)比例 ===");
  console.log(`  作息: ${redlineRate("q1Attitude")}`);
  console.log(`  空间: ${redlineRate("q2Tolerance")}`);
  console.log(`  消息: ${redlineRate("q3Bottomline")}`);
  console.log(`  抽烟: ${redlineRate("q4Bottomline")}`);
  console.log(`  饮酒: ${redlineRate("q5Bottomline")}`);

  // 8. Module 4 价值观分布
  const userMod4 = new Map();
  for (const a of allQA) {
    if (a.module_id !== "module_4") continue;
    if (!userMod4.has(a.user_id)) userMod4.set(a.user_id, {});
    userMod4.get(a.user_id)[a.question_id.split(".")[1]] = a.answer_value;
  }

  // 统计每道题有多少个选项值
  const qDist = {};
  for (const [, m4] of userMod4) {
    for (const [key, val] of Object.entries(m4)) {
      if (!qDist[key]) qDist[key] = {};
      qDist[key][val] = (qDist[key][val] || 0) + 1;
    }
  }
  console.log("\n=== 8. Module 4 价值观分布 ===");
  for (const [q, dist] of Object.entries(qDist)) {
    console.log(`  ${q}:`, dist);
  }

  // 估算匹配分数
  console.log("\n=== 9. 分数估算 ===");
  // 对于1对通过性别+学段约束的用户，估算各维度分数
  // 随机数据下各维度的期望值

  // 价值观：6道题每道3选项，相同概率 1/3
  const valueExpected = (1/3) * 20; // 约6.67
  console.log(`  价值观契合度期望值: ~${valueExpected.toFixed(1)}/20 → ${(valueExpected/20*100).toFixed(0)}/100`);

  // 生活习惯：5维度每维度0-3分
  const lifestyleExpected = 7.5; // 默认值，随机数据约7.5-9
  console.log(`  生活习惯期望值: ~7.5-9/15 → 50-60/100`);

  // 人格：10维度，每维度0-2.5分
  const personalityExpected = 12.5; // 默认值
  console.log(`  人格匹配期望值: ~12.5/25 → 50/100`);

  // 兴趣重叠：Jaccard
  console.log(`  兴趣重叠期望值: 低，随机选项交集少`);

  // 期望匹配
  const expectationExpected = 10; // 默认中值
  console.log(`  期望匹配期望值: ~10/20 → 50/100`);

  // 综合期望分
  const totalExpected =
    33 * 0.20 + // 价值观 → 100分制~33
    53 * 0.15 + // 生活习惯
    50 * 0.25 + // 人格
    30 * 0.20 + // 兴趣
    50 * 0.20;  // 期望
  console.log(`\n  加权综合期望值: ~${totalExpected.toFixed(0)}/100`);
  console.log(`  阈值: 55/100`);
  console.log(`  => 随机数据下，大量配对分数在40-55之间，恰好卡在阈值边缘`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
