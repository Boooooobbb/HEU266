# O_match 匹配算法设计背景介绍

## 1. 项目概述

**项目名称**：O_match（意配）| HEU 校园恋爱匹配交友平台

**核心价值主张**：通过深度问卷建模 + 科学匹配算法，为大学生提供**周期性、经过精心挑选的高质量配对**，替代传统快餐式左滑右滑的交友模式。

**目标用户**：哈工大（HEU）全体在校学生（本科、硕士、博士）

**成熟度**：MVP 阶段
- ✅ 前端工程完整可用
- ✅ 后端基础设施就绪（Supabase BaaS）
- 🚧 匹配算法设计与实现阶段（需要你的设计）

---

## 2. 产品核心机制

### 2.1 匹配周期

- **匹配频率**：每 7 天（每周一次，建议周一早上 08:00）
- **开奖时间**：固定每周一上午 8:00（可配置）
- **配对数量**：每个用户每周最多 1 个潜在配对（MVP 先保证质量与闭环，后续可再扩展）
- **配对有效期**：7 天（下次匹配前，本周配对仍可聊天互动）
- **实现方式**：Supabase Edge Function（定时任务，服务端计算）

### 2.2 用户生命周期

```
1. 注册(Auth)
   - 邮箱验证：仅允许 @hrbeu.edu.cn 校园邮箱
   
2. 资料补充(UserProfile)
   - 性别：Male / Female
   - 学段：本科低年级 / 本科高年级 / 硕士 / 博士
   - 择偶偏好：性别偏好、学段范围、地理位置
   - 头像、昵称等基本信息
   
3. 问卷填写(Questionnaire) [必须完成才能参加匹配]
   - 5 个模块，共 ~30 道题
   - 模块完成后支持自动存草稿
   
4. 匹配等待(WaitingPage)
   - 等待下一个周期的匹配结果
   
5. 查看结果(MatchReportPage)
  - 查看本周的 1 个配对及详情报告
   - 可选接受/拒绝配对
   
6. 聊天互动(ChatRoomPage)
   - 与接受的配对人进行实时聊天
```

---

## 3. 用户数据维度（5 模块问卷设计）

### 3.1 数据采集维度

问卷共分为 5 个模块，用户需按顺序完成。每个模块采集特定维度的用户信息：

#### **模块 1：基础价值观与人生目标** (5 道题)
- 职业规划与发展方向
- 人生终极目标（学业/事业/家庭/社会贡献）
- 对金钱的态度
- 宗教信仰与世界观
- 长期承诺意愿

**数据格式**：多选 + 单选题，采集用户的核心价值观

---

#### **模块 2：生活习惯与日常偏好** (5 道题)
- 作息习惯（早起/晚睡）
- 饮食偏好（素食/辣食/餐饮频率）
- 娱乐方式（宅/社交/运动/文艺）
- 消费水平与理财习惯
- 生活整理度（整洁/随意程度）

**数据格式**：量表题 + 多选，采集用户的日常生活方式

---

#### **模块 3：人格与情感特征** (10 道题)
- 性格倾向（内向/外向 + 理性/感性）
- 情绪稳定性 Likert 量表（1-5 分）
- 交友风格（主动/被动/平衡）
- 冲突处理方式
- 亲密关系中的需求（陪伴/独立/稳定/激情）
- 表达能力与沟通偏好
- 对伴侣的包容度与底线
- 恋爱观（认真寻求长期/体验阶段/随性）
- 性格优点与劣势自评
- 对伴侣性格的期望

**数据格式**：大量 Likert 量表（1-5 分）+ 开放式选项，采集用户的心理画像

---

#### **模块 4：兴趣爱好与共同话题** (7 道题)
- 运动兴趣（篮球、跑步、瑜伽等）
- 文娱爱好（音乐、电影、阅读、游戏等）
- 旅行与冒险意愿
- 对科技/创新的兴趣
- 社交活动参与度
- 学术/研究兴趣
- 其他特殊技能与才艺

**数据格式**：多选题 + 自由文本，采集用户的兴趣交集潜力

---

#### **模块 5：关系期望与伴侣画像** (3 道题)
- 对伴侣外貌的期望（仅供参考，非硬指标）
- 对伴侣性格的 3 个最重要特质
- 理想恋爱中的关键时刻与互动方式

**数据格式**：开放式文本题 + 排序题，采集用户的理想伴侣画像

---

### 3.2 数据存储设计

```sql
-- 问卷答案存储表
CREATE TABLE questionnaire_answers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module_id INT (1-5),           -- 模块编号
  question_id UUID,              -- 题目 ID
  answer_value JSONB,            -- 答案值（支持单选/多选/量表/文本）
  answer_raw TEXT,               -- 原始文本（如需求）
  submitted_at TIMESTAMP,        -- 提交时间
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(user_id, question_id)   -- 防重复
);

-- 用户完成度追踪
CREATE TABLE questionnaire_progress (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  module_completed JSONB,        -- {"module1": true, "module2": true, ...}
  all_modules_completed BOOLEAN DEFAULT FALSE,
  completion_rate DECIMAL(3,2),  -- 0.0-1.0
  last_updated_at TIMESTAMP,
  created_at TIMESTAMP
);

-- 用户向量化特征（匹配用）
CREATE TABLE user_embedding (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- 基础特征向量（one-hot 或 embedding）
  value_vector FLOAT8[],         -- 价值观向量
  lifestyle_vector FLOAT8[],     -- 生活习惯向量
  personality_vector FLOAT8[],   -- 人格向量
  interest_vector FLOAT8[],      -- 兴趣向量
  
  -- 聚合相似度指标（缓存计算结果，加速匹配）
  embedding_hash TEXT,           -- 用于版本控制
  last_computed_at TIMESTAMP
);
```

---

## 4. 匹配算法的输入与输出

### 4.1 算法输入

#### 输入数据（每周匹配时）

1. **活跃用户池**
   - 所有问卷完成度 ≥ 80% 的用户（可调节阈值）
   - 排除已标记为"不可用"的用户
   - 预计 200-1000 人规模

2. **每个用户的特征向量**
   - 价值观、生活习惯、人格、兴趣、期望等多维数据
   - 已归一化或向量化的形式

3. **用户约束条件**（硬约束，必须满足）
   ```yaml
   - 性别偏好：择偶对象性别必须符合用户偏好
   - 学段范围：配对对象学段必须在用户指定范围内
   - 地理位置：（可选）同学院或同校区优先
   - 配对排除名单：用户明确拒绝过的人，本周不再推荐
   - 冷却期：上周配对过的人，本周不再推荐
   ```

4. **黑名单与隐私**
   - 用户的举报/屏蔽列表
   - 隐私设置（如"仅同专业""仅同学年"）

#### 预期输入规模
```
- 周期匹配频率：每 7 天 1 次
- 用户池大小：假设 300-500 活跃用户
- 平均计算时间：< 5 分钟（要求快速响应）
- 内存占用：< 1GB
```

---

### 4.2 算法输出

#### 输出数据结构

```typescript
// 单个配对结果
interface MatchingResult {
  id: string;                    // 本周配对 ID（唯一）
  user_a_id: string;            // 用户 A
  user_b_id: string;            // 用户 B
  match_score: number;          // 匹配得分 (0-100)
  
  // 详细的匹配分析
  compatibility: {
    value_alignment: number;    // 价值观契合度 (0-100)
    lifestyle_fit: number;      // 生活习惯匹配 (0-100)
    personality_match: number;  // 人格互补 (0-100)
    interest_overlap: number;   // 兴趣共同点 (0-100)
  },
  
  // 雷达图数据（用于前端可视化）
  radar_data: {
    label: string[];            // ["价值观", "生活习惯", "性格", "兴趣", "期望"]
    score: number[];            // 各维度得分
  },
  
  // 匹配原因说明（为前端展示用）
  match_reason: string;         // "你们都热爱户外运动，且对人生目标有共识"
  highlight_topics: string[];   // 可聊的话题建议 ["登山", "人生规划"]
  
  matched_at: string;           // ISO 8601 时间戳
  expires_at: string;           // 过期时间（7 天后）
  status: "pending" | "accepted" | "rejected" | "expired";
}

// 一周的完整匹配结果
interface WeeklyMatchingOutput {
  cycle_id: string;             // 本周期 ID (e.g., "2025-W15")
  generated_at: string;         // 生成时间
  total_matches: number;        // 总配对数
  matches: MatchingResult[];    // 具体配对列表
  
  // 统计信息
  stats: {
    total_users: number;        // 本周参与匹配的用户数
    matched_users: number;      // 被配对的用户数
    avg_match_score: number;    // 平均配对得分
  }
}
```

---

### 4.3 算法需满足的业务约束

#### 【硬约束】必须满足
1. ✋ **公平性**：每个用户每周最多获得 1 个配对（不超）
2. 🚫 **互斥性**：若 A 匹配 B，则 B 必匹配 A（配对是对称的）
3. 🔒 **隐私**：不泄露未配对用户的排名或得分
4. ⚖️ **二部图匹配**：男性配女性（或双性别情况下需特殊处理）
5. ❌ **无重复**：同两个用户不在同一周期配对两次

#### 【软约束】尽量优化
1. 📊 **最大化总体得分**：配对的平均得分尽可能高
2. 👥 **高覆盖率**：让尽可能多的用户参与配对（而非只配对少数高分者）
3. 🎯 **多样性**：避免某些用户人气过高而垄断配对
4. 🔄 **新鲜感**：历史未配对过的用户优先级更高
5. 💬 **话题丰富**：同兴趣爱好的配对优先（易产生对话）

---

## 5. 匹配算法的设计考虑

### 5.1 核心思路（推荐）

鉴于项目的小规模集中用户群（校内学生）和周期性匹配特性，推荐采用**"多目标优化 + 启发式算法"**的混合方案：

#### **方案 A：成对相似度 + 二部图最大权匹配**（推荐）
```
Step 1: 计算所有可能的配对相似度矩阵（对称）
        ↓
Step 2: 应用硬约束筛选（性别、学段、排除列表）
        ↓
Step 3: 使用 Hungarian Algorithm（匈牙利算法）或 KM 算法
        求解二部图最大权最匹配
        ↓
Step 4: 后处理
        - 检验约束满足情况
        - 生成配对解释文案
        - 计算雷达图数据
        ↓
Step 5: 持久化到数据库
```

**优势**
- 数学上最优（在给定相似度下，找到全局最优配对）
- 复杂度可控 O(n³)，适合 300-500 人规模
- 易于调试和验证

**实现难度**：中等（需了解图论算法或使用开源库）

---

#### **方案 B：强化学习 + 神经网络**
```
训练一个模型，输入：(用户A特征, 用户B特征) → 输出：配对得分
然后用案例 A 的二部图最大权匹配求解
```

**优势**
- 可自动学习隐含的匹配特征交互
- 随时间迭代改进

**劣势**
- 需要历史配对数据和反馈（初期冷启动难）
- 计算复杂度高
- 不适合 MVP 阶段

---

### 5.2 相似度计算方法（核心）

对于每对用户 (A, B)，计算匹配得分 score(A, B) ∈ [0, 100]：

```yaml
# 法一：加权平均（推荐 MVP 阶段）
score(A, B) = w1 * sim_value(A, B)           # 价值观相似
            + w2 * sim_lifestyle(A, B)       # 生活习惯相似
            + w3 * sim_personality(A, B)     # 人格互补
            + w4 * sim_interest(A, B)        # 兴趣重叠
            + w5 * sim_expectation(A, B)     # 期望匹配

其中权重：w1=0.2, w2=0.15, w3=0.25, w4=0.2, w5=0.2
（可根据数据反馈调整）

# 法二：欧几里得距离
sim = 100 / (1 + sqrt(sum((v_a - v_b)^2)))   # 向量距离

# 法三：余弦相似度
sim = dot(v_a, v_b) / (norm(v_a) * norm(v_b)) * 100
```

#### 各维度的具体计算

**① 价值观相似 (value_alignment)**
```
方法：计算两个用户在"职业目标""人生目标""金钱观"等维度的重叠度
formula: overlap_count / total_count * 100

示例：
- 都选择"学术研究"作为职业方向 → +20 分
- 都重视"家庭"和"个人成长" → +15 分
```

**② 生活习惯相似 (lifestyle_fit)**
```
方法：量表得分的差异倒数
formula: 100 - abs(score_a - score_b) / 5 * 100

示例：
- A 作息得分 4（早起），B 作息得分 4（早起） → 100 分
- A 作息得分 5（晚睡），B 作息得分 2（早起） → 40 分
```

**③ 人格互补 (personality_match)**
```
方法：某些维度"互补"比"相同"更好
公式涉及：
- 内向 vs 外向：互补 +20 分
- 理性 vs 感性：互补 +15 分
- 稳定性：相近 +20 分
- 沟通偏好：相近 +20 分
```

**④ 兴趣重叠 (interest_overlap)**
```
方法：Jaccard 相似系数
formula: |intersection| / |union| * 100

示例：
- A 兴趣: {篮球, 阅读, 旅行}
- B 兴趣: {篮球, 游戏, 旅行}
- 交集: {篮球, 旅行} (2 个)
- 并集: {篮球, 阅读, 旅行, 游戏} (4 个)
- 相似度: 2/4 * 100 = 50 分
```

**⑤ 期望匹配 (expectation_match)**
```
方法：用户对伴侣的期望 vs 真实候选人
- 期望的性格特质完全匹配 → 30 分
- 部分匹配 → 15 分
- 不匹配 → 0 分
```

---

### 5.3 推荐的实现路线

#### **Phase 1（MVP 阶段，2-3 周）**
- ✅ 完成用户问卷数据采集
- ✅ 实现基础相似度计算（加权平均法）
- ✅ 使用贪心算法或 Hungary 算法求解二部图最大匹配
- ✅ 生成简单的匹配报告与话题建议
- 📊 **预期覆盖**: 70-80% 活跃用户能获得配对

#### **Phase 2（优化迭代，1 个月）**
- 🔄 收集用户反馈（接受/拒绝配对数据）
- 📈 调整权重参数，优化匹配效果
- 💬 丰富"话题建议"的生成逻辑
- 🎯 A/B 测试不同的权重配置

#### **Phase 3（高阶特性，可选）**
- 🤖 引入机器学习模型
- 📊 个性化推荐（基于单个用户的反馈历史）
- 🔮 冷启动优化（新用户的快速匹配）

---

## 6. 前端展示与交互

### 6.1 匹配结果界面设计

```
MatchReportPage 需要展示：
├── 本周配对总数统计
├── 配对卡片列表 (1 个)
│   ├── 对方头像、昵称、学段
│   ├── 整体匹配得分 (大号数字，如 82)
│   ├── 五维雷达图
│   │   ├── 价值观: 72%
│   │   ├── 生活习惯: 85%
│   │   ├── 性格互补: 88%
│   │   ├── 兴趣重叠: 75%
│   │   └── 期望匹配: 90%
│   ├── 匹配原因文案 (e.g., "你们都热爱书籍，且对未来有清晰的规划")
│   ├── 可聊的话题标签 (e.g., #读书 #旅行 #考研)
│   └── 接受/拒绝 CTA 按钮
└── 下次匹配倒计时 (e.g., "5 天 2 小时后开奖")
```

### 6.2 数据可视化

**雷达图**：使用 Recharts 或 Chart.js 绘制 5 个维度的匹配强度

```javascript
// 示例数据格式
radarData = {
  labels: ['价值观', '生活习惯', '性格互补', '兴趣重叠', '期望匹配'],
  datasets: [
    {
      label: 'A 的期望',
      data: [72, 85, 88, 75, 90],
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
    },
    {
      label: '平均高分用户',
      data: [65, 70, 75, 68, 80],
      borderColor: 'rgb(220, 53, 69)',
      backgroundColor: 'rgba(220, 53, 69, 0.1)',
    }
  ]
}
```

---

## 7. 数据库表补充设计

```sql
-- 每周匹配结果表
CREATE TABLE weekly_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id VARCHAR UNIQUE,              -- e.g., "2025-W15"
  user_a_id UUID REFERENCES users(id),
  user_b_id UUID REFERENCES users(id),
  match_score INT,                      -- 0-100
  
  -- 详细维度得分
  score_value_alignment INT DEFAULT 0,
  score_lifestyle_fit INT DEFAULT 0,
  score_personality_match INT DEFAULT 0,
  score_interest_overlap INT DEFAULT 0,
  score_expectation_match INT DEFAULT 0,
  
  -- 雷达图数据（JSON）
  radar_data JSONB,
  
  -- 文案
  match_reason TEXT,
  highlight_topics TEXT[], -- 话题建议数组
  
  -- 用户交互状态
  status_a VARCHAR DEFAULT 'pending',   -- pending/accepted/rejected
  status_b VARCHAR DEFAULT 'pending',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- 主键与约束
  CHECK (user_a_id < user_b_id),        -- 规范化: 确保 A < B
  UNIQUE(cycle_id, user_a_id, user_b_id)
);

-- 用户配对交互历史（用于学习与反馈）
CREATE TABLE match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES weekly_matches(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR,                       -- accepted/rejected/liked/disliked
  message TEXT,                         -- 可选的用户反馈文本
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 匹配算法元数据与版本控制
CREATE TABLE matching_algorithm_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id VARCHAR UNIQUE,
  algorithm_version VARCHAR,            -- e.g., "1.0-baseline"
  weights JSONB,                        -- 权重参数快照
  execution_time_ms INT,
  total_users INT,
  total_matches INT,
  avg_match_score DECIMAL(5,2),
  generated_at TIMESTAMP,
  notes TEXT                            -- 本轮调整记录
);
```

---

## 8. 算法验证与调试指标

### 8.1 关键指标（KPI）

```yaml
覆盖率 (Coverage):
  定义: 获得配对的用户数 / 总活跃用户数
  目标: ≥ 80%
  意义: 衡量算法是否"公平"分配配对机会

平均匹配得分 (Avg Match Score):
  定义: 所有配对的平均 match_score
  目标: ≥ 70
  意义: 衡量配对质量

得分分布 (Score Distribution):
  目标: 避免极端分布（太多低分或高分）
  期望: 正态分布，集中在 65-85 之间

用户满意度 (User Satisfaction):
  定义: [接受配对数 / 总配对数] * 100
  目标: ≥ 60%
  意义: 真实反馈算法效果

多样性指标 (Diversity Index):
  定义: 配对用户对的"新鲜度"（历史未配对过的比例）
  目标: ≥ 85%
  意义: 避免重复配对
```

### 8.2 调试与验证

```typescript
// 验证函数伪代码
function validateMatchingResults(matches: MatchingResult[]): ValidationReport {
  const report = {
    isSymmetric: checkSymmetry(matches),           // 检验对称性
    uniqueMatches: hasNoDuplicates(matches),       // 无重复
    hardConstraintsSatisfied: checkConstraints(matches),  // 硬约束
    coverage: calculateCoverage(matches),          // 覆盖率
    avgScore: calculateAvgScore(matches),
    scoreDistribution: analyzeDistribution(matches),
  };
  return report;
}
```

---

## 9. 与前端的集成点

### 9.1 API 接口设计（匹配算法需提供）

```typescript
// 后端 Edge Function 入口
export async function handleWeeklyMatching() {
  // Step 1: 获取所有问卷完成的用户及其特征
  const activeUsers = await getActiveUsers();
  
  // Step 2: 执行匹配算法
  const matchingResults = await runMatchingAlgorithm(activeUsers);
  
  // Step 3: 存储结果
  await saveMatchesToDatabase(matchingResults);
  
  // Step 4: 发送通知给被配对的用户（可选）
  await notifyMatchedUsers(matchingResults);
  
  return {
    cycleId: `2025-W15`,
    totalMatches: matchingResults.length,
    status: 'success'
  };
}

// 前端查询接口
GET /api/matches/current          // 获取本周配对
GET /api/matches/:id              // 获取配对详情
POST /api/matches/:id/accept      // 接受配对
POST /api/matches/:id/reject      // 拒绝配对
```

### 9.2 前端状态管理（Zustand）

```typescript
// src/store/match.ts 需要支持的状态
interface MatchStore {
  // 数据
  currentWeekMatches: MatchingResult[];
  selectedMatch: MatchingResult | null;
  
  // UI 状态
  isLoading: boolean;
  matchingCycleId: string;
  nextMatchTime: Date;
  
  // 方法
  fetchCurrentMatches(): Promise<void>;
  acceptMatch(matchId: string): Promise<void>;
  rejectMatch(matchId: string): Promise<void>;
  calculateCountdown(): string; // 返回格式: "5 天 2 小时"
}
```

---

## 10. 常见问题与应对

### Q1: 如何处理"冷启动"问题？
新用户问卷数据不足，无法参与匹配。
**方案**：
- 前 7 天内完成问卷的新用户，下周即可参加匹配
- 初期可给新用户更宽松的匹配阈值（容忍更低的得分）

### Q2: 如何处理性别不平衡？
假设注册用户中女性占 70%，男性占 30%。
**方案**：
- 引入"人气值"概念：低热度用户优先获得配对
- 或允许某些用户配对多于 1 个（受自愿约束）

### Q3: 如何避免重复配对？
**方案**：
- 在相似度矩阵中，对"历史配对过的"用户对施加大幅度分的惩罚（-50）
- 或直接将其从候选集中排除

### Q4: 算法调参频率？
**建议**：
- 前 4 周：每周调整一次，快速迭代
- 之后：每月调整一次，或基于反馈触发调整

---

## 11. 总结与建议

### 推荐实现方案
```
【立即可做】
1. 实现用户数据采集框架（问卷模块）✅（已有类型定义）
2. 设计相似度算法的基础版本（加权平均）
3. 集成 Hungarian Algorithm 库（或简单贪心算法）
4. 测试与验证

【第二优先级】
5. 收集真实用户数据与反馈
6. 迭代调整权重参数
7. 优化话题生成与匹配文案

【可选/后续】
8. 完整的 A/B 测试框架
9. 机器学习增强
```

### 预期投入
- **算法设计与实现**：1-2 周
- **测试与调参**：1-2 周
- **前端集成**：1 周
- **运维与监控**：持续

---

**本文档版本**：v1.0 | 2025-04-13
**下一步**：使用本背景介绍给其他 AI 讲解项目，请求其设计具体的匹配算法实现方案。
