#!/bin/bash
# 重新填充 match_pool for all 100 users

SECRET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNreHp5YWVqc2Rjamd0aXB6YmFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYwNTcwMywiZXhwIjoyMDkxMTgxNzAzfQ.irS3bLVAhIHaTWJE_8Iu1qUKEoB4mX_BvrUkhRPei8Y"

# 1. 获取有完整5模块问卷的100个用户ID
echo "获取完整问卷用户..."
USER_IDS=$(curl -s \
  -H "Authorization: Bearer $SECRET" \
  -H "apikey: $SECRET" \
  "https://skxzyaejsdcjgtipzban.supabase.co/rest/v1/questionnaire_answers?select=user_id,module_id&limit=5000" | \
  node -e "
const c=require('fs').readFileSync('/dev/stdin','utf8');
const rows=JSON.parse(c);
const m=new Map();
for(const r of rows){
  if(!m.has(r.user_id)) m.set(r.user_id,new Set());
  m.get(r.user_id).add(r.module_id);
}
const ids=[...m.entries()].filter(([,mods])=>mods.size>=5).map(([id])=>id);
console.log(JSON.stringify(ids));
")

TOTAL=$(echo "$USER_IDS" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length.toString())")
echo "共 $TOTAL 个用户"

# 2. 构建 JSON 数组并分批插入
echo "$USER_IDS" | node -e "
const ids=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const rows=ids.map(id=>({user_id:id,week_tag:'2026-W19'}));
let offset=0;
while(offset<rows.length){
  const batch=rows.slice(offset,offset+30);
  const out={'id':batch.map((_,i)=>String.fromCharCode(97+i)).join(''),'rows':batch};
  require('fs').writeFileSync('/tmp/pool_batch_'+(offset/30)+'.json',JSON.stringify(batch));
  offset+=30;
}
console.log('生成 '+(Math.ceil(rows.length/30))+' 个批次文件');
"

# 3. 批量插入
echo "开始插入..."
for f in /tmp/pool_batch_*.json; do
  RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $SECRET" \
    -H "apikey: $SECRET" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    "https://skxzyaejsdcjgtipzban.supabase.co/rest/v1/match_pool" \
    -d "@$f")
  echo "  $f → HTTP $RESULT"
  sleep 0.3
done

# 4. 验证
echo ""
echo "验证 match_pool:"
curl -s \
  -H "Authorization: Bearer $SECRET" \
  -H "apikey: $SECRET" \
  "https://skxzyaejsdcjgtipzban.supabase.co/rest/v1/match_pool?select=count&week_tag=eq.2026-W19"

echo ""
echo "Done."
