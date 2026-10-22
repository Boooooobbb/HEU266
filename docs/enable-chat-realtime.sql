-- 启用 chat_messages 表的 Supabase Realtime 订阅
-- 在 Supabase SQL Editor 中运行此脚本

-- 1. 设置 REPLICA IDENTITY 为 FULL，确保订阅能收到完整的行数据
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- 2. 将 chat_messages 表加入 supabase_realtime 发布
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
