-- ============================================================================
-- O-Match Notification Delivery Schema (Incremental)
-- 用途：阶段一通知能力（站内 + 邮件）
-- 执行方式：在 Supabase SQL Editor 中执行
-- ============================================================================

-- 1) 通知主表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pre_reveal', 'match_result', 'system')),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (idempotency_key, channel)
);

-- 2) 通知投递日志
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  retries INT NOT NULL DEFAULT 0,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) 索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read
  ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_kind_channel
  ON notifications(kind, channel);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id
  ON notification_deliveries(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id_attempted_at
  ON notification_deliveries(user_id, attempted_at DESC);

-- 4) 启用 RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- 5) RLS 策略（幂等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_select_self'
  ) THEN
    CREATE POLICY notifications_select_self
      ON notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_update_read_self'
  ) THEN
    CREATE POLICY notifications_update_read_self
      ON notifications FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_insert_service'
  ) THEN
    CREATE POLICY notifications_insert_service
      ON notifications FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_deliveries' AND policyname = 'notification_deliveries_select_self'
  ) THEN
    CREATE POLICY notification_deliveries_select_self
      ON notification_deliveries FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_deliveries' AND policyname = 'notification_deliveries_insert_service'
  ) THEN
    CREATE POLICY notification_deliveries_insert_service
      ON notification_deliveries FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

-- 6) 自动更新时间
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();
