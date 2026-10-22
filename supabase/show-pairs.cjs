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
      timeout: 60000,
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(); reject(new Error("T/O")); });
    r.end();
  });
}

const L = {
  male: "男", female: "女", both: "都可以",
  undergrad_low:"大一大二", undergrad_high:"大三大四", master:"硕士", doctor:"博士",
  early:"早起☀️", flexible:"弹性⚖️", night:"深夜🦉",
  neat:"整洁✨", chaotic:"乱序📦", casual:"随性🌪️",
  high:"高频📱", normal:"普通⚖️", low:"低频📝",
  never:"从不🚫", sometimes:"偶尔", often:"经常",
  A:"💣红线", B:"💛包容", C:"⭕无所谓",
  save:"储蓄🏦", balance:"平衡⚖️", enjoy:"享乐🎉",
  clear:"清晰🧭", flow:"顺势🌊", explore:"探索🧪",
  task:"任务🎯", love:"关系❤️",
  stable:"稳定🏠", weigh:"权衡⚖️", adventure:"冒险🚀",
  flex:"弹性", emotion:"情感🎁",
  improve:"提升📈", relax:"放松🛋️",
  secure:"安全🤝", anxious:"焦虑📡", avoidant:"回避🏔️",
  boundary:"边界🔒", merge:"融合🔗",
  listen:"倾听🫂", analysis:"分析💡", distract:"转移🎉", alone:"独处🚪",
  certainty:"确定✅", tolerance:"包容🔗", social:"社交🌐",
  communication:"沟通", imbalance:"失衡", compress:"自我压缩",
  words:"肯定言语", time:"精心时刻", gift:"礼物", service:"服务行动", touch:"身体接触",
  physical:"身体接触",
  belonging:"归属感🏠", growth:"成长感🚀", relax2:"松弛感", passion:"激情感🔥",
  safe:"安全感", excited:"兴奋感", grateful:"感恩", adventurous:"冒险", calm:"平静",
};
function lb(v) {
  if (Array.isArray(v)) return v.map(x=>L[x]||x).join(",");
  return L[v]||String(v);
}

async function main() {
  // 1. 获取 top 5 匹配
  const matches = await api(
    "/rest/v1/matches?select=id,user_a_id,user_b_id,match_rate&week_tag=eq.2026-W19&order=match_rate.desc&limit=5"
  );
  const uidSet = new Set();
  matches.forEach(m => { uidSet.add(m.user_a_id); uidSet.add(m.user_b_id); });
  const uids = [...uidSet];

  // 2. 批量获取 profiles
  const profiles = await api(`/rest/v1/profiles?select=*&id=in.(${uids.join(",")})`);
  const pMap = new Map(profiles.map(p=>[p.id,p]));

  // 3. 分批获取问卷答案 (2批，每批5个用户)
  const qaMap = new Map();
  for (let i=0; i<uids.length; i+=5) {
    const batch = uids.slice(i,i+5);
    for (const uid of batch) {
      const qa = await api(`/rest/v1/questionnaire_answers?select=user_id,module_id,question_id,answer_value&user_id=eq.${uid}&limit=100`);
      const mods = {};
      for (const a of qa) {
        if (!mods[a.module_id]) mods[a.module_id] = {};
        mods[a.module_id][a.question_id.split(".").pop()] = a.answer_value;
      }
      qaMap.set(uid, mods);
    }
  }

  // 4. 展示
  const SN = { undergrad_low:"大一大二", undergrad_high:"大三大四", master:"硕士", doctor:"博士" };

  for (let pi=0; pi<matches.length; pi++) {
    const m = matches[pi];
    const A=pMap.get(m.user_a_id), B=pMap.get(m.user_b_id);
    const qA=qaMap.get(m.user_a_id), qB=qaMap.get(m.user_b_id);
    const aShort=m.user_a_id.substring(0,10), bShort=m.user_b_id.substring(0,10);

    console.log(`\n$"=".repeat(66)}`);
    console.log(`  🎯 匹配 #${pi+1} — 匹配率 ${m.match_rate}%`);
    console.log(`$"=".repeat(66)}`);
    console.log(`  用户A: ${aShort}.. | ${lb(A.gender)} ${SN[A.stage]} 期望${lb(A.expected_gender)} | 活动:${lb(A.locations)}`);
    console.log(`  用户B: ${bShort}.. | ${lb(B.gender)} ${SN[B.stage]} 期望${lb(B.expected_gender)} | 活动:${lb(B.locations)}`);

    // Module 2
    console.log(`\n  ── Module 2 生活习惯 ──`);
    for (const k of ["q1Schedule","q1Attitude","q2Space","q2Tolerance","q3Frequency","q3Bottomline","q4Smoking","q4Bottomline","q5Alcohol","q5Bottomline"]) {
      const a=qA?.module_2?.[k], b=qB?.module_2?.[k];
      const tag = a===b?" ✅":"";
      const names={q1Schedule:"作息",q1Attitude:"作息态度",q2Space:"空间",q2Tolerance:"空间态度",q3Frequency:"消息频率",q3Bottomline:"消息底线",q4Smoking:"抽烟",q4Bottomline:"抽烟底线",q5Alcohol:"饮酒",q5Bottomline:"饮酒底线"};
      console.log(`  ${(names[k]||k).padEnd(10)} | ${lb(a).padEnd(18)} | ${lb(b).padEnd(18)}${tag}`);
    }

    // Module 3
    console.log(`\n  ── Module 3 性格 (滑块0-4, 偏好:S=相似/C=互补/N=无所谓) ──`);
    for (let q=1;q<=10;q++) {
      const sa=qA?.module_3?.[`q${q}Slider`], sb=qB?.module_3?.[`q${q}Slider`];
      const pa=qA?.module_3?.[`q${q}Preference`], pb=qB?.module_3?.[`q${q}Preference`];
      const ps={similar:"S",complement:"C",natural:"N"};
      const diff=sa!==undefined&&sb!==undefined?Math.abs(sa-sb):"?";
      const pTag=pa===pb?"一致":ps[pa]+"/"+ps[pb];
      const qNames={1:"E↔I",2:"N↔S",3:"F↔T",4:"J↔P",5:"效率",6:"应急",7:"消费",8:"规划",9:"适应",10:"压力"};
      console.log(`  Q${q} ${(qNames[q]||"").padEnd(4)} | 滑块 ${sa}/${sb} 差${diff} | 偏好 ${pTag}`);
    }

    // Module 4
    console.log(`\n  ── Module 4 价值观 ──`);
    for (const k of ["q1","q2","q3","q4","q5","q6"]) {
      const a=qA?.module_4?.[k], b=qB?.module_4?.[k];
      const tag=a===b?" ✅":"";
      const names={q1:"意外之财",q2:"毕业去向",q3:"压力vs陪伴",q4:"陌生城市",q5:"消费方式",q6:"理想周末"};
      console.log(`  ${(names[k]||k).padEnd(12)} | ${lb(a).padEnd(14)} | ${lb(b).padEnd(14)}${tag}`);
    }

    // Module 5
    console.log(`\n  ── Module 5 亲密关系 ──`);
    for (const k of ["q1","q2","q3","q4","q5","q6","q7"]) {
      const a=qA?.module_5?.[k], b=qB?.module_5?.[k];
      const arrOverlap = Array.isArray(a)&&Array.isArray(b) ? (a.some(x=>b.includes(x))?" ⚡":"") : "";
      const tag = Array.isArray(a) ? arrOverlap : (a===b?" ✅":"");
      const names={q1:"依恋类型",q2:"爱的语言",q3:"个人空间",q4:"低落时需要",q5:"安全感来源",q6:"消耗感来源",q7:"核心感受"};
      console.log(`  ${(names[k]||k).padEnd(12)} | ${lb(a).padEnd(28)} | ${lb(b).padEnd(28)}${tag}`);
    }
  }
}

main().catch(e=>{console.error("❌",e.message);process.exit(1);});
