const https = require("https");
const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";
const WEEK = "2026-W20";

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
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function deleteUser(id) {
  return new Promise((resolve) => {
    const url = new URL(`/auth/v1/admin/users/${id}`, BASE);
    const opts = {
      hostname: url.hostname, path: url.pathname, method: "DELETE",
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET },
      timeout: 15000,
    };
    const r = https.request(opts, (res) => {
      resolve(res.statusCode);
    });
    r.on("error", () => resolve(0));
    r.end();
  });
}

async function main() {
  // 1. 获取所有 test_ 用户
  console.log("1. 获取测试用户列表...");
  const usersResp = await new Promise((resolve) => {
    const url = new URL("/auth/v1/admin/users?per_page=2000", BASE);
    https.get(url, { headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET }, timeout: 30000 }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on("error", (e) => { console.error(e); resolve({ users: [] }); });
  });

  const testUsers = (usersResp.users || []).filter((u) => u.email && u.email.startsWith("test_"));
  console.log(`   总用户: ${usersResp.users?.length}, test_用户: ${testUsers.length}`);

  // 2. 批量删除
  console.log("2. 删除 test_ 用户...");
  let delDone = 0;
  for (let i = 0; i < testUsers.length; i += 10) {
    const batch = testUsers.slice(i, i + 10);
    await Promise.all(batch.map(deleteUser));
    delDone += batch.length;
    process.stdout.write(`   ${delDone}/${testUsers.length}\r`);
  }
  console.log("\n   ✅ 删除完成");

  // 3. 清理残留数据
  console.log("3. 清理 matches + match_pool...");
  await api("DELETE", "/rest/v1/matches?week_tag=eq.2026-W20");
  await api("DELETE", "/rest/v1/match_pool?week_tag=eq.2026-W20");

  // 4. 生成 200 个新用户
  console.log("4. 生成 200 个新用户（带 interests）...");
  let generated = 0;
  while (generated < 200) {
    const batchSize = 100;
    const result = await new Promise((resolve, reject) => {
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
      r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
      r.write(JSON.stringify({ count: batchSize }));
      r.end();
    });
    if (result.code) { console.log(`   ❌ ${result.code}`); break; }
    generated += result.createdCount;
    console.log(`   ✅ ${result.createdCount}个, 累计 ${generated}/200`);
    if (generated < 200) await new Promise((r) => setTimeout(r, 3000));
  }

  // 5. 运行匹配
  console.log("5. 🚀 运行匹配 (200人)...");
  const t0 = Date.now();
  const matchResult = await new Promise((resolve, reject) => {
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
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    r.write("{}"); r.end();
  });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (matchResult.code) { console.log(`   ❌ ${matchResult.code}`); return; }
  console.log(`   ✅ ${sec}s, ${matchResult.matchesCreated} 匹配, ${matchResult.unmatchedCount} 未匹配`);

  // 6. 检查报告
  console.log("\n6. 📊 六维报告:");
  const reports = await api("GET", "/rest/v1/match_reports?select=content&limit=3&order=created_at.desc");
  for (const rep of reports) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    console.log(`   总分 ${c.compatibility_score}:`);
    c.dimensions.forEach((d) =>
      console.log(`     ${d.name}: ${d.score} (w:${(d.weight * 100).toFixed(0)}%)`)
    );
    console.log("");
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
