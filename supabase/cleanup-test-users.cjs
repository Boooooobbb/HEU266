/**
 * 批量删除 test_ 前缀的用户
 */
const https = require("https");
const ids = require("/tmp/test_user_ids.json");

const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";

function deleteUser(id) {
  return new Promise((resolve, reject) => {
    const url = `https://skxzyaejsdcjgtipzban.supabase.co/auth/v1/admin/users/${id}`;
    const req = https.request(
      url,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ id: id.substring(0, 8), status: res.statusCode }));
      }
    );
    req.on("error", (e) => reject(e));
    req.end();
  });
}

async function batchDelete(ids, concurrency = 10) {
  let done = 0;
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(deleteUser));
    done += batch.length;
    const errors = results.filter((r) => r.status !== 200);
    if (errors.length > 0) console.log("  Errors:", errors);
    process.stdout.write(`\r  已删除: ${done}/${ids.length}`);
  }
  console.log("\n✅ 完成!");
}

batchDelete(ids, 10);
