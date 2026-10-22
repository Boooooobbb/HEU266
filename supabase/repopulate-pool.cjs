/**
 * 将所有有完整问卷的用户重新加入 match_pool
 */
const https = require("https");

const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        apikey: SECRET,
        "Content-Type": "application/json",
      },
    };
    const r = https.request(opts, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    r.on("error", reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function main() {
  // 1. 获取所有有完整问卷的用户
  let allQA = [];
  let offset = 0;
  while (true) {
    const batch = await api("GET", `/rest/v1/questionnaire_answers?select=user_id,module_id&limit=1000&offset=${offset}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allQA = allQA.concat(batch);
    offset += 1000;
  }

  const userModules = new Map();
  for (const a of allQA) {
    if (!userModules.has(a.user_id)) userModules.set(a.user_id, new Set());
    userModules.get(a.user_id).add(a.module_id);
  }
  const completeUsers = [...userModules.entries()]
    .filter(([, mods]) => mods.size >= 5)
    .map(([id]) => id);

  console.log(`找到 ${completeUsers.length} 个有完整5模块问卷的用户`);

  // 2. 获取 match_pool 当前状态
  const pool = await api("GET", "/rest/v1/match_pool?select=user_id&week_tag=eq.2026-W19");
  const existingInPool = new Set(pool.map((p) => p.user_id));
  console.log(`当前 match_pool(2026-W19): ${pool.length} 人`);

  // 3. 将缺失的用户加入 match_pool
  const toAdd = completeUsers.filter((id) => !existingInPool.has(id));
  console.log(`需要加入: ${toAdd.length} 人`);

  if (toAdd.length > 0) {
    const rows = toAdd.map((user_id) => ({
      user_id,
      week_tag: "2026-W19",
    }));

    // 分批插入（每批20个）
    for (let i = 0; i < rows.length; i += 20) {
      const batch = rows.slice(i, i + 20);
      const result = await api("POST", "/rest/v1/match_pool", batch);
      if (result.error) {
        console.log(`  批次 ${i / 20} 错误:`, result);
      } else {
        console.log(`  批次 ${i / 20 + 1}: 插入 ${batch.length} 条 ✓`);
      }
    }
  }

  // 4. 验证
  const finalPool = await api("GET", "/rest/v1/match_pool?select=user_id&week_tag=eq.2026-W19");
  console.log(`\n最终 match_pool(2026-W19): ${finalPool.length} 人`);
}

main().catch(console.error);
