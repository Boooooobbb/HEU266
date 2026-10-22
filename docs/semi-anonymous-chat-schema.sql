-- ============================================================================
-- O-Match Semi-Anonymous Chat Incremental Schema
-- 说明：在 Supabase SQL Editor 中执行；用于解盲申请、举报拉黑、联系方式管理。
-- ============================================================================

-- 1) 用户联系方式表（微信 / QQ / 抖音）
CREATE TABLE IF NOT EXISTS user_contact_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('wechat', 'qq', 'douyin')),
  contact_value TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- 2) 解盲申请表（双方同意才解盲）
CREATE TABLE IF NOT EXISTS identity_reveal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, requester_id, responder_id)
);

-- 3) 聊天举报表
CREATE TABLE IF NOT EXISTS chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) 聊天拉黑表
CREATE TABLE IF NOT EXISTS chat_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, blocker_id, blocked_user_id)
);

-- 5) chat_messages 扩展字段
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'contact_card', 'system')),
  ADD COLUMN IF NOT EXISTS client_msg_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_client_msg_id
  ON chat_messages(client_msg_id)
  WHERE client_msg_id IS NOT NULL;

-- 6) 索引
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_user_id ON user_contact_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_reveal_requests_match_id ON identity_reveal_requests(match_id);
CREATE INDEX IF NOT EXISTS idx_identity_reveal_requests_status ON identity_reveal_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_reports_match_id ON chat_reports(match_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_match_id ON chat_blocks(match_id);

-- 7) 启用 RLS
ALTER TABLE user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_reveal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;

-- 8) RLS 策略（幂等创建）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_contact_methods' AND policyname = 'user_contact_methods_select_self'
  ) THEN
    CREATE POLICY user_contact_methods_select_self
      ON user_contact_methods FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_contact_methods' AND policyname = 'user_contact_methods_upsert_self'
  ) THEN
    CREATE POLICY user_contact_methods_upsert_self
      ON user_contact_methods FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'identity_reveal_requests' AND policyname = 'identity_reveal_requests_select_participants'
  ) THEN
    CREATE POLICY identity_reveal_requests_select_participants
      ON identity_reveal_requests FOR SELECT
      USING (auth.uid() = requester_id OR auth.uid() = responder_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'identity_reveal_requests' AND policyname = 'identity_reveal_requests_insert_requester'
  ) THEN
    CREATE POLICY identity_reveal_requests_insert_requester
      ON identity_reveal_requests FOR INSERT
      WITH CHECK (
        auth.uid() = requester_id
        AND EXISTS (
          SELECT 1 FROM matches m
          WHERE m.id = identity_reveal_requests.match_id
            AND (
              (m.user_a_id = requester_id AND m.user_b_id = responder_id)
              OR (m.user_b_id = requester_id AND m.user_a_id = responder_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'identity_reveal_requests' AND policyname = 'identity_reveal_requests_update_participants'
  ) THEN
    CREATE POLICY identity_reveal_requests_update_participants
      ON identity_reveal_requests FOR UPDATE
      USING (auth.uid() = requester_id OR auth.uid() = responder_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reports' AND policyname = 'chat_reports_insert_reporter'
  ) THEN
    CREATE POLICY chat_reports_insert_reporter
      ON chat_reports FOR INSERT
      WITH CHECK (
        auth.uid() = reporter_id
        AND EXISTS (
          SELECT 1 FROM matches m
          WHERE m.id = chat_reports.match_id
            AND (
              (m.user_a_id = reporter_id AND m.user_b_id = reported_user_id)
              OR (m.user_b_id = reporter_id AND m.user_a_id = reported_user_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reports' AND policyname = 'chat_reports_select_reporter'
  ) THEN
    CREATE POLICY chat_reports_select_reporter
      ON chat_reports FOR SELECT
      USING (auth.uid() = reporter_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_blocks' AND policyname = 'chat_blocks_insert_blocker'
  ) THEN
    CREATE POLICY chat_blocks_insert_blocker
      ON chat_blocks FOR INSERT
      WITH CHECK (
        auth.uid() = blocker_id
        AND EXISTS (
          SELECT 1 FROM matches m
          WHERE m.id = chat_blocks.match_id
            AND (
              (m.user_a_id = blocker_id AND m.user_b_id = blocked_user_id)
              OR (m.user_b_id = blocker_id AND m.user_a_id = blocked_user_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_blocks' AND policyname = 'chat_blocks_select_participants'
  ) THEN
    CREATE POLICY chat_blocks_select_participants
      ON chat_blocks FOR SELECT
      USING (auth.uid() = blocker_id OR auth.uid() = blocked_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_blocks' AND policyname = 'chat_blocks_delete_blocker'
  ) THEN
    CREATE POLICY chat_blocks_delete_blocker
      ON chat_blocks FOR DELETE
      USING (auth.uid() = blocker_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages_insert_when_not_blocked'
  ) THEN
    CREATE POLICY chat_messages_insert_when_not_blocked
      ON chat_messages
      AS RESTRICTIVE
      FOR INSERT
      WITH CHECK (
        NOT EXISTS (
          SELECT 1 FROM chat_blocks cb
          WHERE cb.match_id = chat_messages.match_id
            AND (
              (cb.blocker_id = chat_messages.sender_id AND cb.blocked_user_id <> chat_messages.sender_id)
              OR (cb.blocked_user_id = chat_messages.sender_id AND cb.blocker_id <> chat_messages.sender_id)
            )
        )
      );
  END IF;
END $$;

-- 9) 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_contact_methods_updated_at ON user_contact_methods;
CREATE TRIGGER trg_user_contact_methods_updated_at
BEFORE UPDATE ON user_contact_methods
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_identity_reveal_requests_updated_at ON identity_reveal_requests;
CREATE TRIGGER trg_identity_reveal_requests_updated_at
BEFORE UPDATE ON identity_reveal_requests
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_chat_reports_updated_at ON chat_reports;
CREATE TRIGGER trg_chat_reports_updated_at
BEFORE UPDATE ON chat_reports
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();
