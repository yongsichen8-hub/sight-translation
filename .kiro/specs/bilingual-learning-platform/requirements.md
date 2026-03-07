# 需求文档

## 简介

双语学习平台是一个服务于专业领域学习者的综合性工具，帮助用户完成"发现优质内容 → 双语深度对比 → 积累个人专业知识"的完整学习闭环。平台集成了三大核心功能：智能每日简报（自动从互联网收集四大领域的重要新闻并提供中英标题）、双语对照研习模式（用户主动提供英文报道链接，系统提取正文后与中文原文并排展示）、以及交互式术语收藏与个人术语库（在阅读中划选英文术语并构建结构化的个人专业词库）。

与之前的双语新闻平台不同，本平台不再尝试自动配对中英文文章，而是采用"系统提供中文简报 + 用户主动寻找英文对照"的模式，将用户的主动学习行为融入产品流程，降低系统复杂度的同时提升学习效果。

## 术语表

- **Daily_Briefing（每日简报）**：系统每天自动生成的新闻摘要页面，按领域分类展示当日重要新闻
- **Briefing_Generator（简报生成器）**：负责从互联网新闻源抓取、筛选并生成每日简报的后端服务组件
- **News_Entry（新闻条目）**：简报中的单条新闻，包含中文标题、英文翻译标题、摘要、来源和领域分类
- **Study_Session（研习会话）**：用户针对某条新闻发起的一次双语对照阅读活动，包含中文原文和用户提供的英文原文
- **Content_Extractor（内容提取器）**：负责访问用户提供的英文报道链接并智能提取纯正文内容的后端服务组件
- **Comparison_View（对照视图）**：左栏中文原文、右栏英文原文的并排阅读界面
- **Term（术语）**：用户在阅读过程中收藏的英文单词或短语，附带中文释义、领域分类和出处语境
- **Term_Library（术语库）**：用户所有已收藏术语的集合，支持浏览、搜索和按领域筛选
- **Domain（领域）**：新闻和术语的分类维度，固定为四个领域：AI科技、国际经济/金融经济、国际政治、汽车
- **Source_Registry（来源注册表）**：存储和管理所有可信中文新闻源信息的数据存储

## 需求

### 需求 1：每日简报自动生成

**用户故事：** 作为专业领域学习者，我希望每天打开应用就能看到一份按领域分好类的新闻简报，以便快速了解各领域最新动态并选择感兴趣的内容进行深度学习。

#### 验收标准

1. THE Briefing_Generator SHALL 在每天早上 9:00（服务器时区）自动触发简报生成流程
2. WHEN 简报生成流程触发时，THE Briefing_Generator SHALL 从 Source_Registry 中注册的中文新闻源抓取过去 24 小时内发布的新闻文章
3. THE Briefing_Generator SHALL 为 AI科技、国际经济/金融经济、国际政治、汽车四个 Domain 各筛选出 3 条最重要的新闻，共计 12 条 News_Entry
4. WHEN 某个 Domain 在过去 24 小时内的候选新闻不足 3 条时，THE Briefing_Generator SHALL 保留该 Domain 所有可用的候选新闻，不从其他 Domain 补充
5. THE Briefing_Generator SHALL 为每条 News_Entry 记录中文标题、新闻摘要、原始来源 URL、媒体名称和发布时间
6. THE Briefing_Generator SHALL 将每条 News_Entry 的中文标题自动翻译为英文标题，并存储在 News_Entry 中
7. IF 简报生成流程执行失败，THEN THE Briefing_Generator SHALL 在 15 分钟后自动重试，最多重试 3 次
8. IF 某个新闻源在抓取过程中不可访问，THEN THE Briefing_Generator SHALL 跳过该来源并记录错误日志，继续从其他来源抓取
9. THE Source_Registry SHALL 仅收录官方、有声望和社会影响力的权威中文媒体机构作为新闻源

### 需求 2：简报浏览界面

**用户故事：** 作为用户，我希望在应用首页以清晰的分类布局浏览每日简报，以便快速定位感兴趣的领域和新闻。

#### 验收标准

1. THE Daily_Briefing SHALL 作为应用首页展示，用户进入应用后直接看到当日简报
2. THE Daily_Briefing SHALL 将 News_Entry 按 Domain 分组展示，每个 Domain 区块显示该领域的所有新闻条目
3. THE Daily_Briefing SHALL 为每条 News_Entry 展示中文标题、英文翻译标题、新闻摘要、媒体名称和发布时间
4. THE Daily_Briefing SHALL 为每条 News_Entry 提供一个"精读"按钮，用户点击后进入该新闻的 Study_Session
5. WHEN 当日简报尚未生成时，THE Daily_Briefing SHALL 显示"今日简报正在生成中"的提示信息
6. THE Daily_Briefing SHALL 支持查看历史日期的简报，用户可通过日期选择器切换日期

### 需求 3：双语对照研习会话

**用户故事：** 作为用户，我希望能为感兴趣的新闻找到对应的英文报道，并在一个沉浸式的双语对照界面中进行深度阅读和翻译学习。

#### 验收标准

1. WHEN 用户在 Daily_Briefing 中点击某条 News_Entry 的"精读"按钮时，THE 系统 SHALL 创建一个新的 Study_Session 并导航到研习页面
2. THE Study_Session 页面 SHALL 在左侧面板显示该 News_Entry 的完整中文原文
3. THE Study_Session 页面 SHALL 在右侧面板提供一个 URL 输入框，引导用户粘贴英文报道原文链接
4. WHEN 用户提交英文报道 URL 后，THE Content_Extractor SHALL 访问该 URL 并智能提取新闻报道的纯英文正文内容
5. THE Content_Extractor SHALL 清除提取内容中的广告、导航栏、侧边栏和其他非正文元素
6. IF Content_Extractor 无法访问用户提供的 URL，THEN THE 系统 SHALL 显示明确的错误提示并允许用户重新输入 URL
7. IF Content_Extractor 无法从页面中提取有效正文内容，THEN THE 系统 SHALL 提示用户该链接可能不包含可提取的新闻正文，并允许用户手动粘贴英文正文
8. WHEN 英文正文提取成功后，THE Study_Session 页面 SHALL 切换为 Comparison_View，左栏显示中文原文，右栏显示英文原文
9. THE Comparison_View SHALL 支持两栏独立滚动，用户可自由对照阅读中英文内容
10. THE Study_Session SHALL 将中文原文、英文原文和英文来源 URL 持久化存储，用户可在之后重新打开已完成的 Study_Session

### 需求 4：交互式术语收藏

**用户故事：** 作为用户，我希望在双语对照阅读过程中能够随时划选英文术语并收藏到个人词库，以便积累专业领域的英文表达。

#### 验收标准

1. WHEN 用户在 Comparison_View 的英文原文面板中用鼠标划选（高亮）一个单词或短语时，THE 系统 SHALL 在划选位置旁弹出一个"收藏为术语"按钮
2. WHEN 用户点击"收藏为术语"按钮时，THE 系统 SHALL 弹出一个术语编辑表单
3. THE 术语编辑表单 SHALL 自动填入用户划选的英文内容作为术语的英文字段
4. THE 术语编辑表单 SHALL 提供一个中文释义输入框，供用户输入该术语的自定义中文释义
5. THE 术语编辑表单 SHALL 提供一个 Domain 选择器，默认选中当前 News_Entry 所属的 Domain，用户可修改
6. THE 术语编辑表单 SHALL 自动捕获并显示该术语在英文原文中出现的原句作为语境，用户可编辑该语境内容
7. WHEN 用户确认保存术语时，THE 系统 SHALL 将该 Term（英文术语、中文释义、Domain、语境原句、出处 Study_Session ID）持久化存储到用户的 Term_Library 中
8. IF 用户未填写中文释义即尝试保存，THEN THE 系统 SHALL 提示用户中文释义为必填项
9. WHEN 术语保存成功后，THE 系统 SHALL 在英文原文中对该术语文本添加高亮标记，表示该术语已被收藏

### 需求 5：个人术语库管理

**用户故事：** 作为用户，我希望有一个独立的页面来浏览、搜索和管理我收藏的所有术语，以便系统性地复习和巩固专业词汇。

#### 验收标准

1. THE Term_Library 页面 SHALL 以列表形式展示用户所有已收藏的 Term，每条记录显示英文术语、中文释义、所属 Domain 和收藏时间
2. THE Term_Library 页面 SHALL 提供按 Domain 筛选的功能，用户可选择查看特定领域下的所有术语
3. THE Term_Library 页面 SHALL 提供关键词搜索功能，支持按英文术语或中文释义进行模糊搜索
4. WHEN 用户点击某条 Term 时，THE Term_Library SHALL 展示该术语的完整详情，包括英文术语、中文释义、语境原句、所属 Domain 和出处文章信息
5. THE Term_Library SHALL 支持用户编辑已收藏术语的中文释义和语境内容
6. THE Term_Library SHALL 支持用户删除已收藏的术语
7. THE Term_Library SHALL 按收藏时间倒序排列术语，最新收藏的术语显示在最前面

### 需求 6：新闻内容抓取与来源管理

**用户故事：** 作为用户，我希望简报中的新闻都来自可信赖的权威媒体，以确保学习材料的质量和可靠性。

#### 验收标准

1. THE Briefing_Generator SHALL 仅从 Source_Registry 中注册的新闻源抓取文章内容
2. THE Source_Registry SHALL 为每个新闻源记录媒体名称、RSS feed URL、主要覆盖的 Domain 和启用状态
3. THE Source_Registry SHALL 覆盖 AI科技、国际经济/金融经济、国际政治、汽车四个 Domain，每个 Domain 至少有 2 个注册新闻源
4. THE Briefing_Generator SHALL 基于新闻的报道频次和时效性对候选新闻进行重要性排序，从中筛选每个 Domain 的 Top 3
5. WHEN 抓取到一篇文章时，THE Briefing_Generator SHALL 保留该文章的完整中文正文，供 Study_Session 使用
6. THE Daily_Briefing SHALL 为每条 News_Entry 展示原始来源媒体名称，用户可点击来源链接在新窗口中查看原文
