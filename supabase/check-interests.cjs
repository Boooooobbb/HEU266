const https = require("https");
const SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y";
const BASE = "https://skxzyaejsdcjgtipzban.supabase.co";

function api(p) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, BASE);
    https.get(u, { headers: { Authorization: `Bearer ${SECRET}`, apikey: SECRET }, timeout: 30000 }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on("error", (e) => { console.error("err:", e.message); resolve(null); });
  });
}

async function main() {
  // 1. 查一个匹配
  const matches = await api("/rest/v1/matches?select=user_a_id,user_b_id,match_rate&limit=3");
  if (!matches || !matches[0]) { console.log("No matches found"); return; }
  console.log("Matches:", matches.length);

  // 2. 查第一个用户的 module_1 答案
  const uid = matches[0].user_a_id;
  console.log("Checking user:", uid);

  const answers = await api(`/rest/v1/questionnaire_answers?select=*&user_id=eq.${uid}&module_id=eq.module_1`);
  console.log("Module 1 answers:", answers?.length);
  if (answers) answers.forEach(a => {
    console.log(`  ${a.question_id} = ${JSON.stringify(a.answer_value)}`);
  });

  // 3. 查所有用户的 interests 记录数
  const allInterests = await api("/rest/v1/questionnaire_answers?select=count&question_id=eq.module_1.interests");
  console.log("\nTotal interests records:", allInterests?.[0]?.count || "N/A");

  // 4. 随机查几个用户有没有 interests
  const sample = await api("/rest/v1/questionnaire_answers?select=user_id,answer_value&question_id=eq.module_1.interests&limit=5");
  console.log("Sample interests:", sample?.length);
  if (sample) sample.forEach(a => console.log(`  ${a.user_id?.substring(0,10)} → ${JSON.stringify(a.answer_value)}`));
}

main().catch(e => console.error(e.message));
