-- ============================================================================
-- O-Match Supabase Database Schema
-- 注意: 执行此脚本时，auth 表会由 Supabase 自动创建，无需重复创建
-- ============================================================================

-- ============================================================================
-- 1. 用户相关表
-- ============================================================================

-- 用户扩展资料表（与 auth.users 关联）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 基础信息
  nickname TEXT,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  
  -- 教育背景
  stage TEXT CHECK (stage IN ('undergrad_low', 'undergrad_high', 'master', 'doctor')),
  
  -- 匹配偏好
  expected_gender TEXT CHECK (expected_gender IN ('male', 'female', 'both')),
  partner_stages JSONB DEFAULT '[]'::jsonb, -- ["undergrad_high", "master"]
  locations JSONB DEFAULT '[]'::jsonb,       -- ["图书馆", "食堂"]
  
  -- 系统字段
  questionnaire_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 隐私设置表
CREATE TABLE IF NOT EXISTS privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 隐私开关
  show_profile BOOLEAN DEFAULT TRUE,
  allow_messages BOOLEAN DEFAULT TRUE,
  allow_match BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. 问卷相关表
-- ============================================================================

-- 问卷模块定义
CREATE TABLE IF NOT EXISTS questionnaire_modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  
  -- 排序与状态
  sort_order INT,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 问卷题目定义
CREATE TABLE IF NOT EXISTS questionnaire_questions (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES questionnaire_modules(id) ON DELETE CASCADE,
  
  -- 题目内容
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'multiple', 'text')),
  is_required BOOLEAN DEFAULT TRUE,
  
  -- 选项（JSON 格式: [{"value": "...", "label": "..."}]）
  options JSONB,
  
  -- 排序
  sort_order INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户答案记录
CREATE TABLE IF NOT EXISTS questionnaire_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  module_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  
  -- 答案内容（支持文本、单选、多选）
  answer_value JSONB,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 复合索引：用户同一题目只能有一条答案
  UNIQUE(user_id, question_id)
);

-- ============================================================================
-- 3. 匹配相关表
-- ============================================================================

-- 当前周匹配参与者池
CREATE TABLE IF NOT EXISTS match_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 所属周（YYYY-WW 格式）
  week_tag TEXT NOT NULL,
  
  -- 参与状态
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 复合索引：一个用户一周只能加入一次
  UNIQUE(user_id, week_tag)
);

-- 匹配结果表
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 双向关联
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 匹配信息
  match_rate FLOAT CHECK (match_rate >= 0 AND match_rate <= 100),
  
  -- 所属周
  week_tag TEXT NOT NULL,
  
  -- 状态：pending（待接受）、matched（已接受）、failed（未匹配）、expired（已过期）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'failed', 'expired')),
  
  -- 过期时间（通常为 7 天后）
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 复合索引：一个用户在一周内只能有一个匹配
  UNIQUE(user_a_id, week_tag),
  UNIQUE(user_b_id, week_tag)
);

-- 匹配报告表（用于展示匹配详情）
CREATE TABLE IF NOT EXISTS match_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  
  -- 报告内容（JSON 格式）
  -- {
  --   "compatibility_score": 85,
  --   "dimensions": [
  --     {"name": "性格契合度", "score": 90},
  --     {"name": "三观一致度", "score": 80}
  --   ],
  --   "summary": "你们在很多方面都很契合..."
  -- }
  content JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. 聊天相关表
-- ============================================================================

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 消息内容
  content TEXT NOT NULL,
  
  -- 标记为read的时间（NULL表示未读）
  read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 聊天已读状态（优化查询）
CREATE TABLE IF NOT EXISTS chat_read_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 最后阅读消息时间
  last_read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(match_id, user_id)
);

-- ============================================================================
-- 5. 索引优化
-- ============================================================================

-- 用户答案查询优化
CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_user_id 
  ON questionnaire_answers(user_id);

CREATE INDEX IF NOT EXISTS idx_questionnaire_answers_module_id 
  ON questionnaire_answers(module_id);

-- 匹配池查询优化
CREATE INDEX IF NOT EXISTS idx_match_pool_week_tag 
  ON match_pool(week_tag);

CREATE INDEX IF NOT EXISTS idx_match_pool_joined_at 
  ON match_pool(joined_at);

-- 匹配结果查询优化
CREATE INDEX IF NOT EXISTS idx_matches_week_tag 
  ON matches(week_tag);

CREATE INDEX IF NOT EXISTS idx_matches_status 
  ON matches(status);

CREATE INDEX IF NOT EXISTS idx_matches_expires_at 
  ON matches(expires_at);

-- 聊天消息查询优化
CREATE INDEX IF NOT EXISTS idx_chat_messages_match_id 
  ON chat_messages(match_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id 
  ON chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
  ON chat_messages(created_at DESC);

-- 聊天已读状态查询优化
CREATE INDEX IF NOT EXISTS idx_chat_read_state_match_id 
  ON chat_read_state(match_id);

-- ============================================================================
-- 6. 触发器：自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用于需要自动更新时间戳的表
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questionnaire_answers_updated_at
  BEFORE UPDATE ON questionnaire_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_reports_updated_at
  BEFORE UPDATE ON match_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_read_state_updated_at
  BEFORE UPDATE ON chat_read_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. 初始化问卷模块
-- ============================================================================

INSERT INTO questionnaire_modules (id, title, description, sort_order, is_active)
VALUES
  ('module_1', '基础画像', '基本信息填写', 1, TRUE),
  ('module_2', '生活颗粒度', '日常生活习惯', 2, TRUE),
  ('module_3', '性格调色盘', '性格特征分析', 3, TRUE),
  ('module_4', '三观与旷野', '价值观与人生观', 4, TRUE),
  ('module_5', '亲密关系说明书', '恋爱观与期望', 5, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------ Module 1 题目 ------
INSERT INTO questionnaire_questions (id, module_id, title, type, options, sort_order, is_required)
VALUES
  ('q1_1', 'module_1', '你的性别是？', 'single', 
   '[{"value": "male", "label": "男生", "icon": "man"}, 
     {"value": "female", "label": "女生", "icon": "woman"}]', 1, TRUE),
  ('q1_2', 'module_1', '期待相遇的灵魂是？', 'single',
   '[{"value": "male", "label": "男生", "icon": "man"}, 
     {"value": "female", "label": "女生", "icon": "woman"},
     {"value": "both", "label": "都可以，灵魂契合最重要", "icon": "auto_awesome"}]', 2, TRUE),
  ('q1_3', 'module_1', '你所在的学段是？', 'single',
   '[{"value": "undergrad_low", "label": "大一大二"}, 
     {"value": "undergrad_high", "label": "大三大四"},
     {"value": "master", "label": "硕士"},
     {"value": "doctor", "label": "博士"}]', 3, TRUE),
  ('q1_4', 'module_1', '期待伴侣的学段？', 'multiple',
   '[{"value": "undergrad_low", "label": "大一大二"}, 
     {"value": "undergrad_high", "label": "大三大四"},
     {"value": "master", "label": "硕士"},
     {"value": "doctor", "label": "博士"},
     {"value": "both", "label": "都可以"}]', 4, TRUE),
  ('q1_6', 'module_1', '你的兴趣爱好是什么？（可多选，最多12项）', 'multiple',
   '[{"value":"跳舞","emoji":"💃"},{"value":"篮球","emoji":"🏀"},{"value":"足球","emoji":"⚽"},{"value":"羽毛球","emoji":"🏸"},{"value":"乒乓球","emoji":"🏓"},{"value":"跑步","emoji":"🏃"},{"value":"健身","emoji":"💪"},{"value":"游泳","emoji":"🏊"},{"value":"瑜伽","emoji":"🧘"},{"value":"骑行","emoji":"🚴"},{"value":"滑雪","emoji":"🎿"},{"value":"滑冰","emoji":"⛸️"},{"value":"摄影","emoji":"📷"},{"value":"绘画","emoji":"🎨"},{"value":"音乐","emoji":"🎵"},{"value":"吉他","emoji":"🎸"},{"value":"钢琴","emoji":"🎹"},{"value":"小提琴","emoji":"🎻"},{"value":"阅读","emoji":"📚"},{"value":"写作","emoji":"✍️"},{"value":"电影","emoji":"🎬"},{"value":"动漫","emoji":"🎭"},{"value":"游戏","emoji":"🎮"},{"value":"编程","emoji":"💻"},{"value":"烹饪","emoji":"🍳"},{"value":"烘焙","emoji":"🧁"},{"value":"咖啡","emoji":"☕"},{"value":"旅行","emoji":"✈️"},{"value":"徒步","emoji":"🥾"},{"value":"露营","emoji":"🏕️"},{"value":"滑板","emoji":"🛹"},{"value":"桌游","emoji":"🎲"},{"value":"象棋","emoji":"♟️"},{"value":"剧本杀","emoji":"🔍"},{"value":"密室逃脱","emoji":"🗝️"},{"value":"手工","emoji":"✂️"},{"value":"养宠","emoji":"🐱"},{"value":"种花","emoji":"🌻"},{"value":"看展","emoji":"🏛️"},{"value":"话剧","emoji":"🎭"},{"value":"演唱会","emoji":"🎤"},{"value":"追星","emoji":"🌟"},{"value":"汉服","emoji":"👘"},{"value":"街舞","emoji":"🕺"},{"value":"说唱","emoji":"🎙️"},{"value":"架子鼓","emoji":"🥁"},{"value":"二次元","emoji":"🌸"},{"value":"书法","emoji":"🖌️"},{"value":"钓鱼","emoji":"🎣"},{"value":"攀岩","emoji":"🧗"},{"value":"蹦极","emoji":"🪂"},{"value":"电竞","emoji":"🎮"}]', 6, TRUE),
  ('q1_5', 'module_1', '你常在哪些地方散步/活动？', 'multiple',
   '[{"value": "hangzhou_center", "label": "启航活动中心"},
     {"value": "library", "label": "图书馆"},
     {"value": "boat_building", "label": "船海楼"},
     {"value": "11_building", "label": "11号楼"},
     {"value": "21_building", "label": "21号楼"},
     {"value": "31_building", "label": "31号楼"},
     {"value": "41_building", "label": "41号楼"},
     {"value": "61_building", "label": "61号楼"},
     {"value": "south_gym", "label": "南体"},
     {"value": "north_gym", "label": "北体"},
     {"value": "military_field", "label": "军工操场"},
     {"value": "gymnasium", "label": "体育馆"},
     {"value": "dormitory", "label": "宿舍"},
     {"value": "cafeteria", "label": "各大食堂"}]', 5, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------ Module 2 题目 ------
INSERT INTO questionnaire_questions (id, module_id, title, type, options, sort_order, is_required)
VALUES
  ('q2_1_main', 'module_2', '1. 作息结界：你的日常生物钟是怎样的？', 'single',
   '[{"value": "early", "label": "早起自律派", "emoji": "🌅"}, 
     {"value": "flexible", "label": "弹性凡人派", "emoji": "⚖️"},
     {"value": "night", "label": "深夜灵感派", "emoji": "🦉"}]', 1, TRUE),
  ('q2_1_sub', 'module_2', '对于对方的作息，你的态度是？', 'single',
   '[{"value": "A", "label": "必须和我同频 💣"}, 
     {"value": "B", "label": "最好相似，但我能包容 💛"},
     {"value": "C", "label": "无所谓，互不打扰就行 ⭕"}]', 1, FALSE),
  ('q2_2_main', 'module_2', '2. 空间信仰：对于个人空间的整洁度？', 'single',
   '[{"value": "neat", "label": "极度整洁", "emoji": "✨"}, 
     {"value": "chaotic", "label": "乱中有序", "emoji": "📦"},
     {"value": "casual", "label": "随性洒脱", "emoji": "🌪️"}]', 2, TRUE),
  ('q2_2_sub', 'module_2', '如果对方的卫生习惯和你差异极大，你能接受吗？', 'single',
   '[{"value": "A", "label": "绝对不能接受 💣"}, 
     {"value": "B", "label": "稍微有点介意 💛"},
     {"value": "C", "label": "完全不介意 ⭕"}]', 2, FALSE),
  ('q2_3_main', 'module_2', '3. 消息频率：你期望日常的微信沟通节奏是？', 'single',
   '[{"value": "slow", "label": "低频深度型", "emoji": "📝"}, 
     {"value": "balanced", "label": "平衡型", "emoji": "⚖️"},
     {"value": "always", "label": "常聊陪伴型", "emoji": "📱"}]', 3, TRUE),
  ('q2_3_sub', 'module_2', '如果对方的沟通频率和你不匹配，你会？', 'single',
   '[{"value": "A", "label": "无法接受，很容易吵架 💣"}, 
     {"value": "B", "label": "容易失落，但能尝试适应 💛"},
     {"value": "C", "label": "尊重对方节奏 ⭕"}]', 3, FALSE),
  ('q2_4_main', 'module_2', '4. 烟酒结界：你对烟/酒的态度是？', 'single',
   '[{"value": "no_smoke_drink", "label": "烟酒都拒绝", "emoji": "🚫"}, 
     {"value": "occasional", "label": "社交时可以", "emoji": "🍺"},
     {"value": "flexible", "label": "无所谓", "emoji": "😎"}]', 4, TRUE),
  ('q2_4_sub', 'module_2', '这是你无法协商的底线吗？', 'single',
   '[{"value": "A", "label": "是的，必须同意 💣"}, 
     {"value": "B", "label": "有点介意，但可商量 💛"},
     {"value": "C", "label": "完全不是底线 ⭕"}]', 4, FALSE),
  ('q2_5_main', 'module_2', '5. 社交频率：你期望的群聚频率？', 'single',
   '[{"value": "low", "label": "宅家小聚", "emoji": "🏠"}, 
     {"value": "balanced", "label": "平衡型", "emoji": "⚖️"},
     {"value": "high", "label": "热爱社交", "emoji": "🎉"}]', 5, TRUE),
  ('q2_5_sub', 'module_2', '如果伴侣的社交期望和你截然不同，你会？', 'single',
   '[{"value": "A", "label": "强烈冲突 💣"}, 
     {"value": "B", "label": "能部分妥协 💛"},
     {"value": "C", "label": "完全尊重彼此 ⭕"}]', 5, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ------ Module 3 题目 ------
INSERT INTO questionnaire_questions (id, module_id, title, type, options, sort_order, is_required)
VALUES
  ('q3_1', 'module_3', '1. 连续熬夜赶完了一个大作业，迎来一个空闲的周末，你更倾向于如何"回血"？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_2', 'module_3', '2. 刚结束一场必须参加的集体活动，回到宿舍后的你通常会？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_3', 'module_3', '3. 面对下个月底才截止的重磅期末 Project，你的真实执行状态是？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_4', 'module_3', '4. 你的日常生活通常呈现出怎样的状态？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_5', 'module_3', '5. 在学习/工作效率上，你的自我评价是？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_6', 'module_3', '6. 面对突发情况的应急反应，你通常是？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_7', 'module_3', '7. 在消费观念上，你属于？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_8', 'module_3', '8. 在人生规划的长度上，你通常思考的是？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_9', 'module_3', '9. 你对生活变化的适应度是？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
  ('q3_10', 'module_3', '10. 压力下的你和平时的你区别大吗？', 'single',
   '[{"value": "similar", "emoji": "🪞", "label": "波段相似"}, 
     {"value": "complement", "emoji": "🧩", "label": "波段互补"}]
ON CONFLICT (id) DO NOTHING;

-- ------ Module 4 题目 ------
INSERT INTO questionnaire_questions (id, module_id, title, type, options, sort_order, is_required)
VALUES
  ('q4_1', 'module_4', '1. 你突然获得一笔 5000 元的"意外之财"，你更倾向于如何使用？', 'single',
   '[{"value": "save", "emoji": "🏦", "title": "理性储蓄派（长期主义）", "desc": "大部分存起来或用于未来，消费会谨慎规划。"}, 
     {"value": "balance", "emoji": "⚖️", "title": "平衡分配派（规划享受）", "desc": "一部分存起来，一部分用于奖励自己。"},
     {"value": "enjoy", "emoji": "🎉", "title": "即时享乐派（体验优先）", "desc": "直接用来提升当下幸福感，钱的意义就是\"花掉\"。"}]', 1, TRUE),
  ('q4_2', 'module_4', '2. 面对毕业后的去向选择，你更接近哪种想法？', 'single',
   '[{"value": "clear", "emoji": "🧭", "title": "清晰路径型（目标导向）", "desc": "已经有明确规划，并且在为之持续准备。"}, 
     {"value": "flow", "emoji": "🌊", "title": "顺势而为型（弹性发展）", "desc": "有大致方向，但会根据机会和现实情况灵活调整。"},
     {"value": "explore", "emoji": "🧪", "title": "探索试错型（开放尝试）", "desc": "不急着定方向，更愿意多尝试不同可能。"}]', 2, TRUE),
  ('q4_3', 'module_4', '3. 当学业/工作压力很大，同时另一半希望你多花时间陪伴时，你更可能？', 'single',
   '[{"value": "task", "emoji": "🎯", "title": "任务优先型", "desc": "先把眼前最重要的事情做好，关系可以稍微往后放一放。"}, 
     {"value": "balance", "emoji": "⚖️", "title": "尝试平衡型", "desc": "尽量协调时间，两边都不想放弃，但可能都会有一点妥协。"},
     {"value": "love", "emoji": "❤️", "title": "关系优先型", "desc": "会优先保证陪伴和情感连接，认为关系本身就是最重要的事。"}]', 3, TRUE),
  ('q4_4', 'module_4', '4. 如果有一个机会去一个陌生城市发展，但存在不确定性 vs 留在熟悉环境稳定发展，你更倾向？', 'single',
   '[{"value": "stable", "emoji": "🏠", "title": "稳定优先", "desc": "更看重安全感和确定性，不愿意承担太多未知风险。"}, 
     {"value": "weigh", "emoji": "⚖️", "title": "权衡决策", "desc": "会综合考虑收益与风险，在可控范围内尝试。"},
     {"value": "adventure", "emoji": "🚀", "title": "冒险驱动", "desc": "更愿意抓住可能改变人生的机会，即使风险较大。"}]', 4, TRUE),
  ('q4_5', 'module_4', '5. 在确定关系前的日常相处中，你更认可哪种方式？', 'single',
   '[{"value": "clear", "emoji": "🧾", "title": "边界清晰型", "desc": "倾向 AA 或较明确的分担，认为清晰是关系稳定的基础。"}, 
     {"value": "flex", "emoji": "⚖️", "title": "弹性分担型", "desc": "大体均衡，但不刻意计算，谁方便谁多付一点。"},
     {"value": "emotion", "emoji": "🎁", "title": "情感驱动型", "desc": "不太在意具体分配，更看重\"愿意为对方付出\"的感觉。"}]', 5, TRUE),
  ('q4_6', 'module_4', '6. 一个完全自由的周末，你更理想的状态是？', 'single',
   '[{"value": "improve", "emoji": "📈", "title": "自我提升型", "desc": "学习技能、健身、阅读，让自己变得更好。"}, 
     {"value": "balance", "emoji": "⚖️", "title": "平衡生活型", "desc": "一部分时间放松，一部分时间做有意义的事。"},
     {"value": "relax", "emoji": "🛋️", "title": "纯放松型", "desc": "彻底休息娱乐，什么都不想做才是最好的恢复。"}]', 6, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------ Module 5 题目 ------
INSERT INTO questionnaire_questions (id, module_id, title, type, options, sort_order, is_required)
VALUES
  ('q5_1', 'module_5', '1. 在亲密关系中，当你感到压力或与对方产生矛盾时，你通常会？', 'single',
   '[{"value": "secure", "emoji": "🤝", "title": "安全型", "desc": "我会主动沟通，坦诚说出自己的感受和需求，相信我们能共同解决。"}, 
     {"value": "anxious", "emoji": "📡", "title": "焦虑型", "desc": "我会非常不安，反复试探或追问对方\"还爱不爱我\"，渴望立刻获得确认和安慰。"},
     {"value": "avoidant", "emoji": "🏔️", "title": "回避型", "desc": "我会觉得喘不过气，本能地想要独处冷静，暂时\"躲进洞穴\"里，不愿意讨论这个问题。"}]', 1, TRUE),
  ('q5_2', 'module_5', '2. 当你感到被爱或被在乎时，以下哪种场景最让你心动？（多选）', 'multiple',
   '[{"value": "words", "emoji": "🗣️", "title": "肯定的言语", "desc": "对方认真地夸赞我、发一段真诚的文字表达对我的欣赏。"}, 
     {"value": "time", "emoji": "🧑‍🤝‍🧑", "title": "精心的时刻", "desc": "对方放下手机，专心陪我散步、聊天，或者一起完成一件小事。"},
     {"value": "gift", "emoji": "🎁", "title": "接受礼物", "desc": "对方记得我随口说想要的小东西，或者在特殊日子准备了有意义的礼物。"},
     {"value": "service", "emoji": "🫂", "title": "服务的行动", "desc": "对方在我疲惫时帮我分担琐事（比如取外卖、整理笔记），用行动替我分担压力。"},
     {"value": "touch", "emoji": "🤗", "title": "身体的接触", "desc": "对方自然地拍拍我的头、牵手、拥抱，通过肢体接触传递温暖。"}]', 2, TRUE),
  ('q5_3', 'module_5', '3. 在一段亲密关系中，你觉得"个人空间"对你来说意味着什么？', 'single',
   '[{"value": "boundary", "emoji": "🔒", "title": "重要边界", "desc": "我需要明确的独处时间和私人空间，这能让我保持自我和安全感。"}, 
     {"value": "merge", "emoji": "🔗", "title": "共享融合", "desc": "我更喜欢两个人做什么都在一起，独处时反而容易感到孤单或胡思乱想。"},
     {"value": "balance", "emoji": "⚖️", "title": "动态平衡", "desc": "看状态而定，状态好时可以各自独立，低落时会更依赖对方陪伴。"}]', 3, TRUE),
  ('q5_4', 'module_5', '4. 当你感到情绪低落或疲惫时，你更希望伴侣怎么做？', 'single',
   '[{"value": "listen", "emoji": "🫂", "title": "陪伴倾听", "desc": "什么都不用说，安静地陪着我，听我倾诉就好。"}, 
     {"value": "analysis", "emoji": "💡", "title": "理性分析", "desc": "帮我一起梳理问题，给出建议或解决方案，带我走出困境。"},
     {"value": "distract", "emoji": "🎉", "title": "转移注意力", "desc": "带我出去走走、吃好吃的、看轻松的内容，让我暂时忘掉烦恼。"},
     {"value": "alone", "emoji": "🚪", "title": "尊重独处", "desc": "给我空间自己消化，等我状态恢复后再聊。"}]', 4, TRUE),
  ('q5_5', 'module_5', '5. 你觉得一段关系中，"安全感"主要来源于什么？', 'single',
   '[{"value": "certainty", "emoji": "✅", "title": "确定性", "desc": "对方的言行一致、承诺兑现、消息及时回复，让我感到可预测。"}, 
     {"value": "tolerance", "emoji": "🔗", "title": "包容度", "desc": "即使我犯错或状态不好，对方依然接纳我，不会轻易离开。"},
     {"value": "social", "emoji": "🌐", "title": "社交融入", "desc": "对方愿意把我介绍给朋友家人，让我进入ta的生活圈。"},
     {"value": "boundary", "emoji": "🛡️", "title": "边界清晰", "desc": "对方能明确拒绝暧昧，不让我产生不必要的猜疑。"}]', 5, TRUE),
  ('q5_6', 'module_5', '6. 在关系中，你更容易因为什么而感到"被消耗"？', 'single',
   '[{"value": "communication", "emoji": "🗣️", "title": "无效沟通", "desc": "反复争吵同样的问题，或对方总是回避沟通。"}, 
     {"value": "emotion", "emoji": "📉", "title": "情绪过载", "desc": "需要不断承接对方的负面情绪，自己也被拖垮。"},
     {"value": "imbalance", "emoji": "⚖️", "title": "付出失衡", "desc": "感觉总是自己在主动维系关系，对方回应冷淡。"},
     {"value": "compress", "emoji": "🎭", "title": "自我压缩", "desc": "为了迁就对方，不得不压抑自己的需求和喜好。"}]', 6, TRUE),
  ('q5_7', 'module_5', '7. 你更希望亲密关系带给你的核心感受是？（多选）', 'multiple',
   '[{"value": "belonging", "emoji": "🏠", "title": "归属感", "desc": "有一个随时可以回去的\"港湾\"，知道自己不是一个人。"}, 
     {"value": "growth", "emoji": "🚀", "title": "成长感", "desc": "互相激励，成为更好的自己，共同探索更大的世界。"},
     {"value": "relax", "emoji": "🎭", "title": "松弛感", "desc": "在彼此面前可以完全做自己，不用伪装，不用费力。"},
     {"value": "passion", "emoji": "🔥", "title": "激情感", "desc": "保持心动、新鲜感和浪漫，不让关系变得平淡。"}]', 7, TRUE)
ON CONFLICT (id) DO NOTHING;
