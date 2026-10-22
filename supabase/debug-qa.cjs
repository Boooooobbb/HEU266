const https = require("https");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";

function req(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET },
    };
    const r = https.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    r.on("error", reject);
    r.end();
  });
}

async function main() {
  // 1. 获取 match_pool
  const pool = await req("/rest/v1/match_pool?select=user_id&week_tag=eq.2026-W19");
  console.log("1. match_pool (week=2026-W19):", pool.length, "条");
  const poolIds = new Set(pool.map((p) => p.user_id));

  // 2. 获取 profiles
  const profiles = await req("/rest/v1/profiles?select=id,gender,questionnaire_completed");
  console.log("2. profiles:", profiles.length, "条");
  const profileIds = new Set(profiles.map((p) => p.id));

  // 3. 获取 questionnaire_answers（分页）
  let allQA = [];
  let offset = 0;
  while (true) {
    const batch = await req(
      `/rest/v1/questionnaire_answers?select=user_id,module_id,question_id&limit=1000&offset=${offset}`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    allQA = allQA.concat(batch);
    offset += 1000;
  }
  console.log("3. questionnaire_answers 总条数:", allQA.length);

  // 按用户分组
  const userModules = new Map();
  for (const a of allQA) {
    if (!userModules.has(a.user_id)) userModules.set(a.user_id, new Set());
    userModules.get(a.user_id).add(a.module_id);
  }
  console.log("   有答案的用户数:", userModules.size);

  // 4. 模块完整度分布
  const dist = {};
  for (const [, mods] of userModules) {
    const c = mods.size;
    dist[c] = (dist[c] || 0) + 1;
  }
  console.log("4. 模块完整度分布:");
  for (const [k, v] of Object.entries(dist).sort((a, b) => +a[0] - +b[0])) {
    console.log(`     ${k} 个模块: ${v} 人`);
  }

  // 5. 所有模块名
  const allMods = new Set();
  for (const [, mods] of userModules) for (const m of mods) allMods.add(m);
  console.log("5. 出现的模块名:", [...allMods].sort());

  // 6. 只有1个模块的用户详情
  for (const [uid, mods] of userModules) {
    if (mods.size === 1) {
      const m = [...mods][0];
      // 查该模块有多少题
      const userQ = allQA.filter((a) => a.user_id === uid);
      console.log(`6. 仅有1模块的用户: id=${uid.substring(0,12)} 模块=${m} 题目数=${userQ.length}`);
      console.log("   题目:", userQ.map((a) => a.question_id).join(", "));
      break;
    }
  }

  // 7. 交叉比对
  console.log("7. 交叉比对:");
  const poolWithProfile = [...poolIds].filter((id) => profileIds.has(id));
  const poolWithQA = [...poolIds].filter((id) => userModules.has(id));
  const poolWith5Modules = [...poolIds].filter(
    (id) => (userModules.get(id)?.size || 0) >= 5
  );
  console.log(
    `    match_pool(${poolIds.size}) ∩ profiles(${profileIds.size}) = ${poolWithProfile.length}`
  );
  console.log(
    `    match_pool(${poolIds.size}) ∩ questionnaire(${userModules.size}) = ${poolWithQA.length}`
  );
  console.log(
    `    match_pool(${poolIds.size}) ∩ 5模块完整 = ${poolWith5Modules.length}`
  );
}

main().catch(console.error);
