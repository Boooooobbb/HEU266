# HEU266｜HEU校园恋爱匹配交友项目「🍊意配 / O_match」

面向校园场景的慢社交匹配产品：通过深度问卷建模与匹配算法，为用户提供周期性（如每周一次）的匹配结果与匹配报告，减少左滑右滑的快餐式交友疲劳。

> 本仓库为前端为主的项目（React + TypeScript），前端工程位于 `O_match/`，后端使用 Supabase（BaaS）。

---

## 项目亮点（Features）

- **多维度问卷建模**：围绕价值观、生活习惯、人格、兴趣等维度进行信息采集（五模块问卷，含兴趣标签最多选12个）
- **六维度匹配算法**：价值观(20%) + 生活习惯避雷(20%) + 人格互补(20%) + 关系期待(15%) + 期望(15%) + 兴趣重叠(10%)，采用 Gale-Shapley + Hungarian 算法
- **匹配与报告**：输出契合度、雷达图/描述等数据化浪漫的结果展示
- **慢社交机制**：限制匹配频次、固定开奖时间，降低社交压力
- **Supabase 后端**：Auth 认证、PostgreSQL 数据库（含 RLS 安全策略）、Edge Function 周期匹配与通知投递（部署于 `supabase/functions/`）
- **前端技术栈**：React + TypeScript + Vite + TailwindCSS + React Router + Zustand + Axios
- **匿名聊天室**：72 小时限时匿名聊天，支持解盲申请、举报/拉黑、联系方式交换
- **通知系统**：站内通知列表、未读计数、通知偏好设置，支持邮件投递调度

---

## 项目状态（Project Status）

> 最后更新：2026-05-17，详见 [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

- ✅ **前端工程**：可本地启动与预览，支持无后端的 localStorage 降级模式
- ✅ **Supabase 集成**：认证服务（邮箱注册/登录/登出/重置密码/注销）已接入，支持自动降级
- ✅ **数据库 Schema**：完整定义与 RLS 策略脚本已就绪（见 `docs/`），含通知/匿名聊天/反馈增量表
- ✅ **邮箱域名限制**：后端约束脚本已提供，确保仅允许 `@hrbeu.edu.cn` 注册
- ✅ **问卷系统**：五模块问卷页面与前端进度逻辑已落地，支持 Supabase 答案同步（Module 1 新增兴趣标签，最多选 12 个）
- ✅ **匹配 Edge Function**：完整匹配调度函数已部署（`supabase/functions/match-scheduler/`），含真实六维度评分算法与 Gale-Shapley + Hungarian 配对
- ✅ **通知 Edge Function**：邮件通知投递调度函数已编写（`docs/edge-functions/notification-dispatcher.ts`）
- ✅ **聊天系统**：基础消息收发、实时订阅、解盲申请、举报/拉黑、联系方式交换入口已具备
- ✅ **通知系统**：站内通知列表、未读计数、已读操作、通知偏好设置已接入
- ✅ **反馈工单**：用户反馈提交已接入
- ✅ **匹配算法**：六维度可解释评分函数已完成，含避雷机制、兴趣重叠计算、完整测试套件（见 `supabase/functions/match-scheduler/matching/`）
- 🚧 **真实匹配链路**：matchingService 主要接口仍以本地模拟为主，尚未完全切换到真实后端
- 🚧 **匹配报告**：匹配报告页目前使用前端固定示例数据，需接入 match_reports 真实数据
- 🚧 **聊天时效闭环**：聊天倒计时需基于真实匹配的 expires_at，结束匹配按钮未接业务操作

---

## 仓库结构（Structure）

```
HEU266/
├── O_match/              # 主前端工程（React + TS + Vite）
│   ├── src/
│   │   ├── components/   # 页面与 UI 组件（含完整页面路由）
│   │   ├── services/     # API 服务层（auth、questionnaire、matching、chat、notification…）
│   │   ├── store/        # Zustand 状态管理
│   │   ├── lib/          # Supabase 客户端等基础库
│   │   └── hooks/        # 自定义 React Hooks
│   ├── .env              # 环境变量（Supabase URL / Key）
│   └── package.json
├── supabase/             # Supabase 项目（Edge Functions + 测试工具）
│   ├── config.toml                            # Supabase 本地配置
│   ├── functions/
│   │   ├── match-scheduler/                   # 周期匹配 Edge Function（含完整匹配算法）
│   │   │   ├── index.ts
│   │   │   └── matching/                      # 六维度评分算法、G-S算法、Hungarian算法
│   │   └── test-data-generator/               # 测试数据生成 Edge Function
│   └── *.cjs / *.sh                           # 规模化测试与调试工具
├── docs/                 # 技术文档与数据库脚本
│   ├── PROJECT_STATUS.md                      # 项目现状基线（最新）
│   ├── SUPABASE_SETUP.md                      # Supabase 初始化指南
│   ├── QUESTIONNAIRE_DESIGN.md                # 问卷设计文档
│   ├── MATCHING_ALGORITHM_CONTEXT.md          # 匹配算法上下文
│   ├── database-schema.sql                    # 完整数据库 Schema
│   ├── database-rls.sql                       # 行级安全策略脚本
│   ├── auth-email-domain-constraint.sql       # 邮箱域名限制脚本
│   ├── delete-account-function.sql            # 注销账号函数
│   ├── notification-delivery-schema.sql       # 通知投递增量表
│   ├── semi-anonymous-chat-schema.sql         # 匿名聊天增量表
│   ├── feedback-tickets-schema.sql            # 反馈工单增量表
│   ├── enable-chat-realtime.sql               # 聊天实时订阅配置
│   ├── test-reports/                          # 匹配算法评测报告
│   └── edge-functions/
│       ├── match-scheduler.ts                 # 旧版参考（已由 supabase/functions 替代）
│       └── notification-dispatcher.ts         # 通知投递 Edge Function
├── documents/            # 产品文档（项目计划、问卷设计、日志、UI稿）
└── Html静态预览版/        # HTML 静态原型预览
```

---

## 快速开始（Getting Started）

### 1) 环境要求

- Node.js 18+（推荐使用 LTS 版本）
- npm（本仓库已有 `package-lock.json`，更推荐 npm）

### 2) 安装依赖

```bash
cd O_match
npm install
```

### 3) 配置环境变量（可选）

编辑 `O_match/.env.development`，填入 Supabase 项目信息：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **不配置也可正常开发**：未填写时，认证服务自动降级为本地 localStorage 模拟模式。

### 4) 本地开发启动

```bash
npm run dev
```

启动后访问 `http://localhost:5173`。

### 5) 构建与预览

```bash
npm run build
npm run preview
```

---

## Supabase 后端配置（Backend Setup）

如需连接真实后端，请按以下顺序执行 SQL 脚本并参考对应文档：

1. **[docs/database-schema.sql](docs/database-schema.sql)**：在 SQL Editor 中执行以初始化数据库
2. **[docs/database-rls.sql](docs/database-rls.sql)**：执行行级安全策略
3. **[docs/auth-email-domain-constraint.sql](docs/auth-email-domain-constraint.sql)**：执行邮箱域名限制
4. **[docs/delete-account-function.sql](docs/delete-account-function.sql)**：注销账号函数
5. **[docs/notification-delivery-schema.sql](docs/notification-delivery-schema.sql)**：通知投递增量表
6. **[docs/semi-anonymous-chat-schema.sql](docs/semi-anonymous-chat-schema.sql)**：匿名聊天增量表
7. **[docs/feedback-tickets-schema.sql](docs/feedback-tickets-schema.sql)**：反馈工单增量表
8. **[docs/enable-chat-realtime.sql](docs/enable-chat-realtime.sql)**：启用聊天实时订阅

部署 Edge Function（需安装 Supabase CLI）：

```bash
supabase functions deploy match-scheduler
```

完整初始化说明请参考 **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**。

---

## 技术栈（Tech Stack）

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 样式 | Tailwind CSS |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| HTTP 请求 | Axios |
| 后端服务 | Supabase（Auth + PostgreSQL + Realtime + Edge Functions） |
| 匹配算法 | Gale-Shapley + Hungarian，六维度评分（TypeScript / Deno） |
| 接口模拟 | MSW（Mock Service Worker） |

---

## 开发约定（Development）

```bash
# 代码检查
cd O_match
npm run lint
```

建议在提交前运行 lint，保持代码风格一致。

---

## Roadmap

- [x] 认证服务（邮箱注册/登录/登出/重置密码/注销）+ Supabase Auth 集成
- [x] 数据库 Schema 设计 + RLS 安全策略
- [x] 五模块问卷系统（前端 + Supabase 答案同步，含兴趣标签维度）
- [x] 周期匹配 Edge Function（match-scheduler，部署于 supabase/functions/）
- [x] 可解释匹配算法（六维度评分：价值观/生活习惯/人格/关系期待/期望/兴趣，含避雷机制）
- [x] Gale-Shapley + Hungarian 配对算法，含完整测试套件
- [x] 通知 Edge Function（notification-dispatcher）
- [x] 站内通知系统（列表、未读计数、已读操作、偏好设置）
- [x] 匿名聊天室（消息收发、实时订阅、解盲申请、举报/拉黑）
- [x] 反馈工单提交
- [x] 匹配结果页（成功报告、失败安慰）
- [ ] 真实匹配链路闭环（matchingService 接入后端真实数据）
- [ ] 匹配报告接入真实数据（match_reports + 雷达图）
- [ ] 聊天时效闭环（expires_at 倒计时、结束匹配操作）
- [ ] 通知上线前全链路验证（邮件送达、前端跳转）

---

## 文档（Documents）

产品规划、问卷设计与开发日志等请见 `documents/` 目录：

- `documents/项目计划.md`
- `documents/问卷初版设计.md`
- `documents/项目日志.md`
- `documents/匹配算法开发日志.md`
- `documents/UI设计1.0.html`

技术文档请见 `docs/` 目录，项目现状基线请参考 [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。

---

## 贡献（Contributing）

欢迎提 Issue / PR，一起完善功能、UI 和算法实现。

---

## License

本仓库暂未声明 License。若要开源/协作，建议补充 LICENSE 文件并在此处说明。
