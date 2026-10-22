const https = require("https");
const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W20";

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET, "Content-Type": "application/json" },
      timeout: 60000,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function invoke(func, body, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/functions/v1/${func}`);
    const opts = {
      hostname: u.hostname, path: u.pathname, method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      timeout,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    r.write(JSON.stringify(body));
    r.end();
  });
}

function delUser(id) {
  return new Promise((resolve) => {
    const u = new URL(`/auth/v1/admin/users/${id}`, BASE);
    https.request(u, { method: "DELETE", headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET }, timeout: 15000 }, (res) => resolve(res.statusCode)).on("error", () => resolve(0)).end();
  });
}

async function main() {
  // 1. 删旧用户
  console.log("1. 删除旧 test_ 用户...");
  const usersResp = await api("GET", "/auth/v1/admin/users?per_page=2000");
  const testUsers = (usersResp.users || []).filter((u) => u.email?.startsWith("test_"));
  console.log(`   找到 ${testUsers.length} 个`);

  let del = 0;
  for (let i = 0; i < testUsers.length; i += 10) {
    const batch = testUsers.slice(i, i + 10);
    await Promise.all(batch.map(delUser));
    del += batch.length;
    if (del % 50 === 0 || del === testUsers.length) process.stdout.write(`   ${del}/${testUsers.length}\r`);
  }
  console.log("\n   ✅");

  // 2. 清 matches/pool
  console.log("2. 清理 matches + pool...");
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);
  console.log("   ✅");

  // 3. 生成 100 个新用户
  console.log("3. 生成 100 个新用户（随机兴趣）...");
  const gen = await invoke("test-data-generator", { count: 100 });
  console.log(`   ✅ ${gen.createdCount} 个, pool: ${gen.totalInPool}`);

  // 4. 运行匹配
  console.log("4. 匹配...");
  const t0 = Date.now();
  const match = await invoke("match-scheduler", {});
  console.log(`   ✅ ${((Date.now()-t0)/1000).toFixed(1)}s, ${match.matchesCreated} 匹配`);

  // 5. 验证：查 interests 数据
  console.log("\n5. 验证 interests 数据...");
  const matches = await api("GET", `/rest/v1/matches?select=user_a_id,user_b_id&limit=1`);
  if (matches?.[0]) {
    const uid = matches[0].user_a_id;
    const qa = await api("GET", `/rest/v1/questionnaire_answers?select=*&user_id=eq.${uid}&module_id=eq.module_1`);
    console.log(`   用户 ${uid?.substring(0,12)} Module 1: ${qa?.length} 条`);
    if (qa) qa.forEach(a => console.log(`     ${a.question_id} = ${JSON.stringify(a.answer_value)}`));
  } else {
    console.log("   ⚠️ 无匹配数据，直接查任意新用户");
    const qa = await api("GET", "/rest/v1/questionnaire_answers?select=user_id,answer_value&question_id=eq.module_1.interests&limit=3");
    console.log(`   interests 记录: ${qa?.length} 条`);
    if (qa) qa.forEach(a => console.log(`     ${a.user_id?.substring(0,12)} → ${JSON.stringify(a.answer_value)}`));
  }

  // 6. 检查报告中兴趣维度
  console.log("\n6. 六维报告...");
  const reports = await api("GET", "/rest/v1/match_reports?select=content&limit=3");
  for (const rep of (reports || [])) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    const im = c.dimensions?.find(d => d.name === "兴趣匹配度");
    console.log(`   总分 ${c.compatibility_score}, 兴趣匹配: ${im?.score ?? "?"}`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
