# Supabase 后端开发指南

## 1. Supabase 项目初始化

### 1.1 创建项目
1. 访问 [supabase.com](https://supabase.com)
2. 登录或注册账户
3. 创建新项目
   - 项目名称：`o-match`
   - 数据库密码：设置强密码（记住）
   - 地区：选择最近的地区（推荐 `ap-southeast-1` 或 `ap-northeast-1`）
4. 等待项目初始化完成（约 2-3 分钟）

### 1.2 获取连接信息
项目创建后，在 **Settings** > **API** 中获取：
- `Project URL` → 填入 `VITE_SUPABASE_URL`
- `anon key` (public) → 填入 `VITE_SUPABASE_ANON_KEY`

将这两个值填入 `.env.development` 和 `.env.production`：

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 2. 数据库 Schema 初始化

### 2.1 在 Supabase 中执行 SQL
1. 进入 Supabase Dashboard
2. 左侧菜单 → **SQL Editor**
3. 点击 **New Query**
4. 复制 [database-schema.sql](./database-schema.sql) 的内容
5. 执行

### 2.2 验证表创建成功
1. 左侧菜单 → **Table Editor**
2. 应该看到以下表：
   - `profiles`
   - `questionnaire_modules`
   - `questionnaire_questions`
   - `questionnaire_answers`
   - `match_pool`
   - `matches`
   - `match_reports`
   - `chat_messages`
   - `chat_read_state`
   - `privacy_settings`

## 3. 行级别安全性 (RLS) 配置

### 3.1 启用 RLS
1. 左侧菜单 → **Authentication** > **Policies**
2. 或直接在 Table Editor 中为每个表点击 **Enable RLS**

### 3.2 应用 RLS 策略
执行 [database-rls.sql](./database-rls.sql) 中的所有策略语句。

策略清单：
- **Profiles**：用户只能读写自己的资料
- **Matches**：参与双方可见
- **ChatMessages**：只有匹配的两个用户可见
- **QuestionnaireAnswers**：用户只能读写自己的答案

### 3.3 强制校园邮箱域名
执行 [auth-email-domain-constraint.sql](./auth-email-domain-constraint.sql) 以限制新注册账号必须使用 `@hrbeu.edu.cn` 邮箱。

### 3.4 开启账号注销 RPC（前端“注销账号”按钮）
执行 [delete-account-function.sql](./delete-account-function.sql) 以允许已登录用户通过 RPC `delete_my_account` 注销自己的账号。

### 3.5 开启通知能力（阶段一）
执行 [notification-delivery-schema.sql](./notification-delivery-schema.sql) 以创建：
- `notifications`（站内通知 + 邮件通知记录）
- `notification_deliveries`（投递日志）

> 如果你已执行过旧脚本，可重复执行该脚本，语句为幂等设计。

## 4. 前端集成

### 4.1 安装 Supabase 包
```bash
npm install @supabase/supabase-js
```

### 4.2 配置环境变量
已自动创建的文件：
- `src/lib/supabase.ts` - Supabase 客户端初始化
- `.env` / `.env.development` / `.env.production` - 环境变量模板

只需填入密钥即可。

### 4.3 认证流程已支持两种模式
- **有 Supabase 配置**：自动使用 Supabase Auth
- **无 Supabase 配置**：回退到本地 localStorage 模拟（便于开发）

## 5. Edge Functions（匹配算法）

### 5.1 创建匹配函数
1. Supabase Dashboard → **Functions**
2. 点击 **Create a new function**
3. 选择 **Deno** 模板
4. 参考 [edge-functions/match-scheduler.ts](./edge-functions/match-scheduler.ts)

### 5.2 部署与配置
```bash
supabase functions deploy match-scheduler
```

通知任务函数（阶段一）：
```bash
supabase functions deploy notification-dispatcher
```

### 5.3 配置 Cron 触发
在 Supabase 中设置定时任务：
- **函数名**：`match-scheduler`
- **Cron 表达式**：`55 3 * * WED`（UTC，对应北京时间每周三 11:55）
- **时区**：UTC+8

> 说明：通知函数的预提醒和结果提醒分别在北京时间周三 11:30 / 12:00 触发，
> `match-scheduler` 必须在结果提醒前完成写入 `matches`，否则 `match_result` 模式会出现 `targetCount=0`。

通知函数建议添加两个任务（以 UTC 配置）：
- **函数名**：`notification-dispatcher`，请求体：`{"mode":"pre_reveal"}`
- **Cron**：`30 3 * * WED`（北京时间每周三 11:30）
- **函数名**：`notification-dispatcher`，请求体：`{"mode":"match_result"}`
- **Cron**：`0 4 * * WED`（北京时间每周三 12:00）

> 需在 Edge Function Secrets 中配置：
> - `ALIYUN_ACCESS_KEY_ID`
> - `ALIYUN_ACCESS_KEY_SECRET`
> - `ALIYUN_DM_ACCOUNT_NAME`
> - `ALIYUN_DM_FROM_ALIAS`（可选）
> - `ALIYUN_DM_REGION_ID`（可选，默认 `cn-hangzhou`）
> - `ALIYUN_DM_ENDPOINT`（可选，默认 `https://dm.aliyuncs.com/`）
> - `APP_BASE_URL`（必填，线上域名；用于邮件内跳转链接，示例 `https://app.your-domain.com`）

## 6. 验证清单

- [ ] Supabase 项目已创建
- [ ] 项目 URL 和 API 密钥已添加到 `.env.development`
- [ ] 数据库表已创建（10 个表）
- [ ] RLS 策略已启用
- [ ] 已执行邮箱域名限制脚本（仅允许 `@hrbeu.edu.cn`）
- [ ] 已执行账号注销函数脚本（`delete_my_account`）
- [ ] 已执行通知表脚本（`notification-delivery-schema.sql`）
- [ ] 前端依赖已安装
- [ ] 本地能够注册/登录（Supabase 或本地模拟）
- [ ] 用户资料能够正确加载和更新

## 7. 常见问题

**Q: 表创建失败，提示权限问题？**
A: 检查是否使用了 `postgres` 超级用户运行 SQL。Supabase 默认仅允许该角色创建表。

**Q: auth 表已经存在？**
A: Supabase 在项目创建时自动创建 `auth.users` 表。后续不要再创建。

**Q: RLS 策略应用后，无法读取数据？**
A: 检查是否正确获取了用户 UUID。登录后通过 `supabase.auth.getUser()` 获取。

**Q: Edge Function 如何测试？**
A: 在 Supabase Dashboard → **Functions** 中选择函数，点击 **Invoke** 测试。

**Q: notification-dispatcher 返回 `targetCount=0` 是否异常？**
A: 在“匹配功能尚未完整开发”阶段，这是常见且正常的。

- `mode=pre_reveal` 的目标来源：
   - `match_pool.week_tag = 本周` 的用户
   - 且 `privacy_settings.allow_messages = true`
- `mode=match_result` 的目标来源：
   - `matches.week_tag = 本周` 且 `status in ('matched','failed')` 的用户
   - 且 `privacy_settings.allow_match = true`

如果上述数据不存在，函数会成功执行，但发送数量为 0。

## 8. 通知与匹配对接规范（重点）

本节用于说明：匹配功能完成后，通知功能应如何与匹配模块无缝对接。

### 8.1 对接依赖关系（必须满足）

1. 参与匹配阶段（用于 pre_reveal）
- 前端“加入本周匹配”动作写入 `match_pool`：
   - `user_id`
   - `week_tag`（与通知函数同一周标签规则）
- 用户隐私设置 `privacy_settings.allow_messages` 为 `true` 才会收到预提醒。

2. 结果产出阶段（用于 match_result）
- `match-scheduler` 必须写入 `matches`：
   - `week_tag`
   - `status`（至少包含 `matched` 或 `failed`）
- 用户隐私设置 `privacy_settings.allow_match` 为 `true` 才会收到结果提醒。

3. 报告与入口阶段（前端承接）
- 通知内 `link_path` 已写入：
   - 预提醒默认 `/waiting`
   - 结果提醒默认 `/chat-entry`
- 业务完成后可按产品策略调整为 `/match-report` 等具体路径。

### 8.2 时序约束（必须统一）

推荐每周三揭晓流程：

1. `11:30` 触发 `notification-dispatcher`（`mode=pre_reveal`）
2. `11:55` 触发 `match-scheduler` 生成本周 `matches`
3. `12:00` 触发 `notification-dispatcher`（`mode=match_result`）

如果顺序错位（例如先发结果通知再生成匹配），会出现 `targetCount=0`。

### 8.3 匹配模块完成后的联调检查 SQL

在 SQL Editor 执行以下查询：

```sql
-- 本周周标签（与函数一致的周格式）
select to_char(now(), 'IYYY-"W"IW') as current_week_tag;

-- pre_reveal 目标候选数量
select count(*) as pre_reveal_candidates
from match_pool mp
join privacy_settings ps on ps.user_id = mp.user_id
where mp.week_tag = to_char(now(), 'IYYY-"W"IW')
   and ps.allow_messages = true;

-- match_result 目标候选数量
with weekly_users as (
   select user_a_id as user_id
   from matches
   where week_tag = to_char(now(), 'IYYY-"W"IW')
      and status in ('matched', 'failed')
   union
   select user_b_id as user_id
   from matches
   where week_tag = to_char(now(), 'IYYY-"W"IW')
      and status in ('matched', 'failed')
)
select count(*) as match_result_candidates
from weekly_users wu
join privacy_settings ps on ps.user_id = wu.user_id
where ps.allow_match = true;
```

### 8.4 无匹配模块时的最小造数联调（可选）

如果匹配模块还没接完，但你想先验证通知链路，可临时插入测试数据：

```sql
-- 用你自己的用户 UUID 替换 :uid
-- 用当前周标签替换 :week_tag，例如 2026-W16

insert into privacy_settings (user_id, allow_messages, allow_match)
values (:uid, true, true)
on conflict (user_id)
do update set allow_messages = excluded.allow_messages,
                     allow_match = excluded.allow_match,
                     updated_at = now();

insert into match_pool (user_id, week_tag)
values (:uid, :week_tag)
on conflict (user_id, week_tag) do nothing;
```

> 提示：`mode=match_result` 还依赖 `matches` 有本周记录；若无记录，该模式仍会返回 0。

### 8.5 匹配模块完成后的验收用例（5 条）

以下用例建议在同一周标签下按顺序执行，全部通过后再上线通知链路。

1. 预提醒命中验证（pre_reveal）
- 前置条件：
   - 用户已加入 `match_pool` 本周记录
   - `privacy_settings.allow_messages = true`
- 操作：手动调用 `notification-dispatcher`，`mode=pre_reveal`
- 预期结果：
   - 返回 `targetCount > 0`
   - `inAppSent` 与候选数一致
   - `notifications` 中出现 `kind='pre_reveal'` 且 `channel='in_app'`

2. 结果提醒命中验证（match_result）
- 前置条件：
   - `match-scheduler` 已生成本周 `matches`（`matched` 或 `failed`）
   - `privacy_settings.allow_match = true`
- 操作：手动调用 `notification-dispatcher`，`mode=match_result`
- 预期结果：
   - 返回 `targetCount > 0`
   - `inAppSent` 与候选数一致
   - `notifications` 中出现 `kind='match_result'`

3. 隐私开关过滤验证
- 前置条件：
   - 准备两名用户，A 开启提醒，B 关闭提醒
- 操作：分别触发 `pre_reveal` 与 `match_result`
- 预期结果：
   - A 命中通知
   - B 不命中通知（不应写入通知记录）

4. 幂等验证（避免重复发送）
- 前置条件：同一周、同一用户、同一模式
- 操作：连续调用同一 `mode` 两次
- 预期结果：
   - 第二次不会新增同类通知（依赖 `idempotency_key`）
   - 返回中失败项可出现唯一键冲突，但不应产生重复数据

5. 端到端前端承接验证
- 前置条件：通知写入成功
- 操作：
   - 登录前端账号
   - 查看顶栏未读角标
   - 进入通知列表页执行单条/全部已读
   - 点击通知跳转路径（`/waiting` 或 `/chat-entry`）
- 预期结果：
   - 未读角标数量正确变化
   - 已读状态正确落库
   - 路由跳转与业务状态一致

## 9. 后续动作建议

1. 先确保 `mode=pre_reveal` 能命中目标（站内通知可见）。
2. 再打通 `match-scheduler -> matches` 产出链路。
3. 最后验证 `mode=match_result` 在本周固定时点稳定触发。

当前项目状态请统一参考 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。
