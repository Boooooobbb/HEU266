const https = require("https");
const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W20";

function api(method, path, body) {
  return new Promise((resolve) => {
    const u = new URL(path, BASE);
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
  // ===== 1. 删除所有 test_ 用户 =====
  console.log("1. 删除 test_ 用户...");
  const usersResp = await api("GET", "/auth/v1/admin/users?per_page=2000");
  const testUsers = (usersResp?.users || []).filter((u) => u.email?.startsWith("test_"));
  console.log(`   ${testUsers.length} 个`);

  let del = 0;
  for (let i = 0; i < testUsers.length; i += 15) {
    await Promise.all(testUsers.slice(i, i + 15).map(delUser));
    del += Math.min(15, testUsers.length - i);
    if (del % 100 === 0 || del === testUsers.length) process.stdout.write(`   ${del}/${testUsers.length}\r`);
  }
  console.log("   ✅");

  // ===== 2. 清空 matches + pool =====
  console.log("2. 清空 matches + pool...");
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);
  console.log("   ✅");

  // ===== 3. 生成 200 用户 =====
  console.log("3. 生成 200 用户...");
  let genTotal = 0;
  for (let batch = 1; batch <= 2; batch++) {
    console.log(`   批次 ${batch}/2...`);
    const r = await invoke("test-data-generator", { count: 100 });
    if (!r || r.code) { console.log("   ❌", r); return; }
    genTotal += r.createdCount;
    console.log(`   ✅ ${r.createdCount}个, pool: ${r.totalInPool}`);
    if (batch < 2) await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`   总计: ${genTotal} 用户`);

  // ===== 4. 运行匹配 =====
  console.log("4. 🚀 匹配...");
  const t0 = Date.now();
  const match = await invoke("match-scheduler", {});
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (!match || match.code) { console.log("   ❌", match); return; }
  console.log(`   ✅ ${sec}s, candidates:${match.totalCandidates}, matches:${match.matchesCreated}, unmatched:${match.unmatchedCount}`);

  // ===== 5. 验证 =====
  console.log("\n5. 📊 报告分析...");
  const reports = await api("GET", "/rest/v1/match_reports?select=content&limit=5");

  let interestScores = [];
  for (const rep of (reports || [])) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    const im = c.dimensions?.find((d) => d.name === "兴趣匹配度");
    const sc = im?.score ?? "N/A";
    interestScores.push(sc);
    console.log(`   总分 ${c.compatibility_score}, 兴趣: ${sc} ${sc > 0 ? "✅" : ""}`);
    if (sc > 0) {
      c.dimensions.forEach((d) => console.log(`      ${d.name}: ${d.score} (w:${(d.weight * 100).toFixed(0)}%)`));
    }
  }

  const hasInterestScore = interestScores.some((s) => s > 0);
  console.log(`\n   ${hasInterestScore ? "✅ 兴趣维度有非零分！" : "⚠️ 兴趣维度全零"} (样本: ${interestScores.join(", ")})`);

  // ===== 6. 查一个用户的 interests =====
  console.log("\n6. 抽查用户 interests...");
  const matches = await api("GET", "/rest/v1/matches?select=user_a_id,user_b_id&limit=1");
  if (matches?.[0]) {
    const a = await api("GET", `/rest/v1/questionnaire_answers?select=answer_value&user_id=eq.${matches[0].user_a_id}&question_id=eq.module_1.interests`);
    const b = await api("GET", `/rest/v1/questionnaire_answers?select=answer_value&user_id=eq.${matches[0].user_b_id}&question_id=eq.module_1.interests`);
    console.log(`   用户A: ${JSON.stringify(a?.[0]?.answer_value || "N/A")}`);
    console.log(`   用户B: ${JSON.stringify(b?.[0]?.answer_value || "N/A")}`);
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
