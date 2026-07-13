-- ============================================================================
-- 结构化破冰迁移脚本
-- 将匿名自由聊天升级为三轮结构化破冰流程
-- ============================================================================

-- 1. 扩展 chat_messages.message_type 约束，支持冰破消息类型
-- ============================================================================
-- 先删除旧约束，再添加新约束（覆盖冰破四种新类型）
ALTER TABLE IF EXISTS chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

ALTER TABLE IF EXISTS chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN (
    'text',
    'contact_card',
    'system',
    'ice_round_1',
    'ice_round_2',
    'ice_round_3',
    'connection_card'
  ));

-- 2. 为冰破消息类型添加索引（加速 getRoundStatus 查询）
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type
  ON chat_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_chat_messages_match_type
  ON chat_messages(match_id, message_type);

-- 3. 标记 identity_reveal_requests 表为废弃
-- ============================================================================
-- 三轮破冰的终点是自动交换联系方式，不再需要解盲申请/审批流程。
-- 保留表结构和数据以向后兼容，但新代码不再写入此表。
COMMENT ON TABLE identity_reveal_requests IS 'DEPRECATED: 结构化破冰已替代解盲流程，此表仅供历史数据查询';

-- 4. 可选：为现有 chat_messages 数据做兼容处理
-- ============================================================================
-- 将已有的冰破相关消息（如果有）设置为正确的类型
-- UPDATE chat_messages SET message_type = 'connection_card'
--   WHERE message_type = 'contact_card' AND content LIKE '%已确认交换联系方式%';
