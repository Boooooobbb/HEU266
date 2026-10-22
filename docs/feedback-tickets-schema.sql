-- ============================================================================
-- O-Match Feedback Tickets Schema (Incremental)
-- 用途：站内问题反馈工单，支持用户提交与后台跟进。
-- 执行方式：在 Supabase SQL Editor 中执行。
-- ============================================================================

-- 1) 反馈工单表
CREATE TABLE IF NOT EXISTS feedback_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  type TEXT NOT NULL CHECK (type IN ('问题反馈', '功能建议', '体验优化', '其他')),
  content TEXT NOT NULL,
  contact TEXT,
  source_path TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) 索引
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_user_id
  ON feedback_tickets(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status
  ON feedback_tickets(status);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_at
  ON feedback_tickets(created_at DESC);

-- 3) 启用 RLS
ALTER TABLE feedback_tickets ENABLE ROW LEVEL SECURITY;

-- 4) RLS 策略（避免重复创建）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_tickets'
      AND policyname = 'feedback_tickets_insert_self'
  ) THEN
    CREATE POLICY feedback_tickets_insert_self
      ON feedback_tickets FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_tickets'
      AND policyname = 'feedback_tickets_select_self'
  ) THEN
    CREATE POLICY feedback_tickets_select_self
      ON feedback_tickets FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 5) 更新时间触发器（如果数据库里已有 update_updated_at_column 可直接复用）
CREATE OR REPLACE FUNCTION update_feedback_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feedback_tickets_updated_at ON feedback_tickets;

CREATE TRIGGER trg_feedback_tickets_updated_at
BEFORE UPDATE ON feedback_tickets
FOR EACH ROW
EXECUTE FUNCTION update_feedback_tickets_updated_at();
