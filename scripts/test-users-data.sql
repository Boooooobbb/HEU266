-- ============================================================
-- testa + testb 完整测试数据
-- 在 Supabase Dashboard → SQL Editor 粘贴执行
-- ============================================================

-- 用户 UUID
-- testa: 9ea4d21a-98e2-4775-9e63-871b53465d57
-- testb: 09cc9025-0f97-48db-a02d-2da2f111f4cb

-- ============================================================
-- 1. Profiles
-- ============================================================
INSERT INTO profiles (id, nickname, gender, stage, expected_gender, partner_stages, locations, questionnaire_completed)
VALUES
  ('9ea4d21a-98e2-4775-9e63-871b53465d57', '测试橙子A', 'male', 'master', 'female', '["undergrad_high","master"]', '["哈尔滨"]', true),
  ('09cc9025-0f97-48db-a02d-2da2f111f4cb', '测试橙子B', 'female', 'undergrad_high', 'male', '["master","doctor"]', '["哈尔滨"]', true)
ON CONFLICT (id) DO UPDATE SET nickname=EXCLUDED.nickname, questionnaire_completed=true;

-- ============================================================
-- 2. Matches
-- ============================================================
DELETE FROM match_reports WHERE match_id IN (
  SELECT id FROM matches WHERE user_a_id='9ea4d21a-98e2-4775-9e63-871b53465d57' OR user_b_id='9ea4d21a-98e2-4775-9e63-871b53465d57'
);
DELETE FROM matches WHERE user_a_id='9ea4d21a-98e2-4775-9e63-871b53465d57' OR user_b_id='9ea4d21a-98e2-4775-9e63-871b53465d57';

INSERT INTO matches (user_a_id, user_b_id, match_rate, week_tag, status, expires_at)
VALUES ('9ea4d21a-98e2-4775-9e63-871b53465d57', '09cc9025-0f97-48db-a02d-2da2f111f4cb', 87, '2026-W28', 'matched', now() + interval '7 days');

-- ============================================================
-- 3. Match Report
-- ============================================================
INSERT INTO match_reports (match_id, content)
SELECT id, '{"compatibility_score":87,"dimensions":[{"name":"价值观","score":90,"weight":0.2},{"name":"生活习惯","score":82,"weight":0.2},{"name":"人格互补","score":88,"weight":0.2},{"name":"关系期待","score":85,"weight":0.15},{"name":"期望匹配","score":80,"weight":0.15},{"name":"兴趣匹配","score":92,"weight":0.1}],"radar_data":[90,82,88,85,80,92],"summary":"你们在价值观和兴趣上高度契合，是彼此的灵魂伙伴。","highlight_topics":["深夜思考人生","旅行探索","独立音乐"]}'::jsonb
FROM matches WHERE user_a_id='9ea4d21a-98e2-4775-9e63-871b53465d57';

-- ============================================================
-- 4. Questionnaire Answers（5个模块，每个用户各一套）
-- ============================================================

-- 清理旧数据
DELETE FROM questionnaire_answers WHERE user_id IN ('9ea4d21a-98e2-4775-9e63-871b53465d57', '09cc9025-0f97-48db-a02d-2da2f111f4cb');

-- ==================== testa (male, master) ====================

-- Module 1: 基础画像
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.gender', '"male"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.expectedGender', '"female"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.stage', '"master"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.partnerStages', '["undergrad_high","master"]'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.locations', '["图书馆","体育馆","11号楼"]'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_1', 'module_1.interests', '["独立音乐","旅行","深夜思考"]');

-- Module 2: 生活颗粒度
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q1Schedule', '"balanced"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q1Attitude', '["plan","go_with_flow"]'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q2Space', '"personal_space"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q2Tolerance', '["medium","high"]'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q3Frequency', '"weekly"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q3Bottomline', '["smoking","excessive_gaming"]'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q4Smoking', 'false'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q4Bottomline', '"no_smoking"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q5Alcohol', '"occasional"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_2', 'module_2.q5Bottomline', '"no_drunk"');

-- Module 3: 性格调色盘（10组 slider + preference）
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q1Slider', '70'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q1Preference', '"similar"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q2Slider', '60'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q2Preference', '"complementary"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q3Slider', '80'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q3Preference', '"similar"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q4Slider', '55'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q4Preference', '"complementary"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q5Slider', '65'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q5Preference', '"similar"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q6Slider', '75'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q6Preference', '"complementary"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q7Slider', '50'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q7Preference', '"similar"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q8Slider', '85'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q8Preference', '"complementary"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q9Slider', '45'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q9Preference', '"similar"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q10Slider', '90'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_3', 'module_3.q10Preference', '"complementary"');

-- Module 4: 三观与旷野
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q1', '"探索未知，追求自我成长"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q2', '"顺其自然，享受当下"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q3', '"独立自主，同时尊重他人"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q4', '"任何性别都可以有事业心"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q5', '"先做好自己，再经营关系"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_4', 'module_4.q6', '"经济独立是关系平等的基础"');

-- Module 5: 亲密关系说明书
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q1', '"每周见面2-3次"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q2', '"重大决定一起商量"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q3', '"坦诚沟通，不积压情绪"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q4', '"AA为主，特殊日子请客"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q5', '"希望2-3年内结婚"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q6', '"想要1-2个孩子"'),
('9ea4d21a-98e2-4775-9e63-871b53465d57', 'module_5', 'module_5.q7', '"共同成长是关系的意义"');

-- ==================== testb (female, undergrad_high) ====================

-- Module 1
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.gender', '"female"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.expectedGender', '"male"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.stage', '"undergrad_high"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.partnerStages', '["master","doctor"]'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.locations', '["启航活动中心","体育馆","图书馆"]'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_1', 'module_1.interests', '["旅行","独立音乐","追剧"]');

-- Module 2
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q1Schedule', '"flexible"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q1Attitude', '["go_with_flow"]'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q2Space', '"togetherness"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q2Tolerance', '["high"]'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q3Frequency', '"daily"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q3Bottomline', '["smoking","lying"]'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q4Smoking', 'false'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q4Bottomline', '"no_smoking"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q5Alcohol', '"never"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_2', 'module_2.q5Bottomline', '"no_alcohol"');

-- Module 3
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q1Slider', '65'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q1Preference', '"complementary"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q2Slider', '75'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q2Preference', '"similar"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q3Slider', '55'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q3Preference', '"complementary"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q4Slider', '70'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q4Preference', '"similar"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q5Slider', '80'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q5Preference', '"complementary"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q6Slider', '60'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q6Preference', '"similar"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q7Slider', '85'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q7Preference', '"complementary"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q8Slider', '50'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q8Preference', '"similar"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q9Slider', '90'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q9Preference', '"complementary"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q10Slider', '45'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_3', 'module_3.q10Preference', '"similar"');

-- Module 4
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q1', '"不断学习，成为更好的自己"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q2', '"过程比结果更重要"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q3', '"互相尊重，互相成就"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q4', '"男女在家庭中可以有不同分工"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q5', '"感情需要双方共同经营"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_4', 'module_4.q6', '"经济独立但可以互相支持"');

-- Module 5
INSERT INTO questionnaire_answers (user_id, module_id, question_id, answer_value) VALUES
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q1', '"周末见面，平时各自忙碌"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q2', '"重大决定一起商量"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q3', '"有问题当天说清楚"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q4', '"AA为主"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q5', '"毕业后2-3年内结婚"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q6', '"都可以，和对象商量"'),
('09cc9025-0f97-48db-a02d-2da2f111f4cb', 'module_5', 'module_5.q7', '"陪你把独自孤单变成勇敢"');

SELECT '✅ testa + testb 全部数据已就绪！' AS result;
