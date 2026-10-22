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
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function main() {
  console.log("1. 清空旧数据...");
  await api("DELETE", `/rest/v1/matches?week_tag=eq.${WEEK}`);
  await api("DELETE", `/rest/v1/match_pool?week_tag=eq.${WEEK}`);

  console.log("2. 获取 profiles...");
  const profiles = await api("GET", "/rest/v1/profiles?select=id&limit=600");
  const subset = profiles.slice(-100);
  console.log(`   使用 ${subset.length} 人`);

  console.log("3. 填充 match_pool...");
  const rows = subset.map((p) => ({ user_id: p.id, week_tag: WEEK }));
  for (let i = 0; i < rows.length; i += 50) {
    await api("POST", "/rest/v1/match_pool", rows.slice(i, i + 50));
  }

  console.log("4. 运行匹配...");
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
    r.on("timeout", () => { r.destroy(); reject(new Error("edge_timeout")); });
    r.write("{}"); r.end();
  });
  console.log(`   ${(Date.now()-t0)/1000}s: ${JSON.stringify(result)}`);

  if (result.code) { console.log("❌ 失败"); return; }

  console.log("\n5. 检查 match_reports 六维数据...");
  const reports = await api("GET", "/rest/v1/match_reports?select=content&limit=3");
  for (const rep of reports) {
    const c = typeof rep.content === "string" ? JSON.parse(rep.content) : rep.content;
    console.log(`   维度数: ${c.dimensions?.length}`);
    console.log(`   radar labels: [${c.radar_data?.label?.join(", ")}]`);
    console.log(`   radar scores: [${c.radar_data?.score?.map(s=>Math.round(s)).join(", ")}]`);
    console.log(`   topics: [${c.highlight_topics?.join(", ")}]`);
    console.log(`   总结: ${c.summary}`);
    console.log("");
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
