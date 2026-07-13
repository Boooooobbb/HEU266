/**
 * 创建一对测试匹配用户 testa + testb
 *
 * 用法:
 *   SERVICE_ROLE_KEY=xxx npx tsx scripts/create-test-match.ts
 *
 * 或在 Supabase Dashboard → SQL Editor 中手动执行下方的 SQL。
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://skxzyaejsdcjgtipzban.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 请设置 SERVICE_ROLE_KEY 环境变量');
  console.error('   SERVICE_ROLE_KEY=sb_secret_xxx npx tsx scripts/create-test-match.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WEEK_TAG = `2026-W28`; // 本周
const PASSWORD = '123456';

async function main() {
  console.log('🔧 创建测试用户 testa + testb...\n');

  // 1. 创建两个用户
  const users: { id: string; email: string; nickname: string }[] = [];

  for (const name of ['testa', 'testb']) {
    const email = `${name}@test.omatch.local`;

    // 先尝试删除已有用户（忽略错误）
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const exist = existingUsers?.users?.find((u) => u.email === email);
    if (exist) {
      console.log(`  🗑 删除已有用户 ${email}`);
      await supabase.auth.admin.deleteUser(exist.id);
    }

    // 创建用户
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      console.error(`  ❌ 创建用户 ${email} 失败:`, createError?.message);
      process.exit(1);
    }

    console.log(`  ✅ 用户 ${email} 已创建 (id: ${newUser.user.id})`);
    users.push({ id: newUser.user.id, email, nickname: name === 'testa' ? '测试橙子A' : '测试橙子B' });
  }

  const [userA, userB] = users;

  // 2. 创建 profiles
  console.log('\n📝 创建 profiles...');

  for (const u of [
    { id: userA.id, nickname: userA.nickname, gender: 'male', stage: 'master', expectedGender: 'female', partnerStages: ['undergrad_high', 'master'], locations: ['哈尔滨'] },
    { id: userB.id, nickname: userB.nickname, gender: 'female', stage: 'undergrad_high', expectedGender: 'male', partnerStages: ['master', 'doctor'], locations: ['哈尔滨'] },
  ]) {
    const { error } = await supabase.from('profiles').upsert({
      id: u.id,
      nickname: u.nickname,
      gender: u.gender,
      stage: u.stage,
      expected_gender: u.expectedGender,
      partner_stages: JSON.stringify(u.partnerStages),
      locations: JSON.stringify(u.locations),
      questionnaire_completed: true,
    });

    if (error) {
      console.error(`  ❌ 创建 profile ${u.nickname} 失败:`, error.message);
    } else {
      console.log(`  ✅ profile ${u.nickname} 已创建`);
    }
  }

  // 3. 创建匹配
  console.log('\n💞 创建匹配...');

  const matchRate = 87;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      user_a_id: userA.id,
      user_b_id: userB.id,
      match_rate: matchRate,
      week_tag: WEEK_TAG,
      status: 'matched',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (matchError || !match) {
    console.error('  ❌ 创建匹配失败:', matchError?.message);
    process.exit(1);
  }

  console.log(`  ✅ 匹配已创建 (matchId: ${match.id}, rate: ${matchRate}%)`);

  // 4. 创建匹配报告
  console.log('\n📊 创建匹配报告...');

  const { error: reportError } = await supabase.from('match_reports').upsert({
    match_id: match.id,
    content: {
      compatibility_score: matchRate,
      dimensions: [
        { name: '价值观', score: 90, weight: 0.2 },
        { name: '生活习惯', score: 82, weight: 0.2 },
        { name: '人格互补', score: 88, weight: 0.2 },
        { name: '关系期待', score: 85, weight: 0.15 },
        { name: '期望匹配', score: 80, weight: 0.15 },
        { name: '兴趣匹配', score: 92, weight: 0.1 },
      ],
      radar_data: [90, 82, 88, 85, 80, 92],
      summary: '你们在价值观和兴趣上高度契合，是彼此的灵魂伙伴。',
      highlight_topics: ['深夜思考人生', '旅行探索', '独立音乐'],
    },
  });

  if (reportError) {
    console.error('  ❌ 创建匹配报告失败:', reportError.message);
  } else {
    console.log('  ✅ 匹配报告已创建');
  }

  // 5. 总结
  console.log('\n' + '='.repeat(50));
  console.log('🎉 测试匹配创建成功！\n');
  console.log(`  用户A: ${userA.email} / ${PASSWORD}`);
  console.log(`  用户B: ${userB.email} / ${PASSWORD}`);
  console.log(`  匹配度: ${matchRate}%`);
  console.log(`  Match ID: ${match.id}`);
  console.log('');
  console.log('  登录后可以体验完整破冰流程。');
  console.log('='.repeat(50));
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
