# 实现计划：双语新闻推送平台

## 概述

基于 React + Vite 前端和 Express 后端架构，实现每日自动聚合中英文真实新闻的系统。后端核心包括：Source Registry 权威媒体注册表、RSS 新闻聚合器、OpenAI Embeddings 跨语言语义匹配器、重要性排序器和 node-cron 定时调度器。前端包括新闻列表、双语并排阅读视图和领域筛选。数据采用 JSON 文件存储（FileStorageService 模式）。

## 任务

- [x] 1. 定义数据模型与 Source Registry
  - [x] 1.1 创建 `server/src/types/news.ts`，定义所有新闻相关的 TypeScript 类型
    - 定义 `NewsDomain`、`NewsSource`、`RawArticle`、`NewsItem`、`ArticleRef`、`DailyNews`、`SourceRegistry`、`AggregationResult`、`SourceError`、`UpdateResult` 等接口和类型
    - `NewsSource.tier` 仅允许 `'T1' | 'T2'`，`language` 仅允许 `'zh' | 'en'`
    - `NewsItem.pairingStatus` 仅允许 `'paired' | 'zh-only' | 'en-only'`
    - _需求：1.1, 1.2, 1.6, 1.7, 2.1, 2.4, 2.5, 3.4, 4.1_

  - [x] 1.2 创建 `server/src/data/sourceRegistry.json`，预注册权威媒体列表
    - 中文 T1：新华社、人民日报、央视新闻；中文 T2：财新网、第一财经、36氪、澎湃新闻
    - 英文 T1：Reuters、BBC News、NYT、Bloomberg；英文 T2：TechCrunch、The Economist、Ars Technica、MIT Technology Review
    - 每个源包含 id、name、url（RSS feed URL）、language、domain、tier、weight、enabled 字段
    - T1 级媒体默认 weight ≥ 0.8，T2 级媒体默认 weight ≤ 0.7
    - _需求：1.1, 1.3, 1.6, 1.7, 1.8_

  - [x] 1.3 创建 `server/src/services/SourceRegistryService.ts`，实现来源注册表的加载和查询
    - 从 JSON 文件加载 Source Registry，提供 `getSources()`、`getSourceById()`、`getSourcesByLanguage()` 方法
    - 启动时校验所有源的 tier 字段合法性（仅 T1/T2）
    - _需求：1.1, 1.6, 1.7, 1.8_

  - [ ]* 1.4 编写属性测试：新闻源信誉等级合法性（Property 17）
    - **属性 17：新闻源信誉等级合法性**
    - 使用 `fast-check` 验证：Source_Registry 中任意 NewsSource 的 tier 必须为 'T1' 或 'T2'，且 T1 级媒体的默认 weight ≥ T2 级媒体的默认 weight
    - **验证需求：1.7**

  - [ ]* 1.5 编写单元测试：Source Registry 配置验证
    - 验证 Source Registry 包含至少5个中文源和5个英文源（需求1.3）
    - 验证所有源均为 T1 或 T2 级（需求1.7）
    - 验证不包含自媒体或个人博客类来源（需求1.8）
    - _需求：1.3, 1.6, 1.7, 1.8_

- [x] 2. 实现 News_Aggregator 新闻聚合器
  - [x] 2.1 创建 `server/src/services/NewsAggregator.ts`，实现 RSS 新闻抓取
    - 使用 `rss-parser` 库解析各新闻源的 RSS feed
    - 实现 `fetchArticles(since: Date)` 方法，从所有启用的源抓取过去24小时的文章
    - 实现 `fetchFromSource(source: NewsSource)` 方法，从单个源抓取并解析文章
    - 为每篇文章记录 url、sourceName、publishedAt，确保字段非空
    - 仅提取原始标题、摘要和正文，不生成或改写内容
    - _需求：1.1, 1.2, 1.4, 1.5, 3.2_

  - [x] 2.2 实现聚合器容错机制
    - 单个源不可访问时跳过该源，记录 `SourceError`，继续抓取其他源
    - 单源超时30秒后跳过
    - 过滤 publishedAt 不在 [since, now] 时间窗口内的文章
    - 返回 `AggregationResult`，包含成功抓取的文章和错误列表
    - _需求：1.4, 3.2_

  - [ ]* 2.3 编写属性测试：文章来源合法性（Property 1）
    - **属性 1：文章来源合法性**
    - 验证 News_Aggregator 返回的任意文章，其 sourceId 必须存在于 Source_Registry 中
    - **验证需求：1.1**

  - [ ]* 2.4 编写属性测试：文章元数据完整性（Property 2）
    - **属性 2：文章元数据完整性**
    - 验证任意 RawArticle 的 url、sourceName、publishedAt 为非空字符串，publishedAt 为有效 ISO 8601 时间戳
    - **验证需求：1.2**

  - [ ]* 2.5 编写属性测试：聚合器容错性（Property 3）
    - **属性 3：聚合器容错性**
    - 验证部分源不可访问时，仍返回可访问源的文章，并为不可访问源生成 SourceError
    - **验证需求：1.4**

  - [ ]* 2.6 编写属性测试：24小时时间窗口过滤（Property 8）
    - **属性 8：24小时时间窗口过滤**
    - 验证返回的文章 publishedAt 均在 [T-24h, T] 范围内
    - **验证需求：3.2**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 实现 Topic_Matcher 主题匹配器
  - [x] 4.1 创建 `server/src/services/TopicMatcher.ts`，实现跨语言语义匹配
    - 使用 OpenAI Embeddings API 将文章标题+摘要转为向量
    - 实现 `computeSimilarity(articleA, articleB)` 方法，计算余弦相似度
    - 实现 `matchArticles(articles)` 方法，将中英文文章按语义相似度配对
    - 配对相似度必须超过配置的最低阈值
    - 无法配对的文章标记为 'zh-only' 或 'en-only'
    - _需求：2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 实现新闻主题摘要生成
    - 实现 `generateTopicSummary()` 方法，为每个配对的 NewsItem 生成统一的新闻主题摘要
    - 摘要概括该事件的核心内容，确保 topicSummary 为非空字符串
    - _需求：2.5_

  - [x] 4.3 实现 Embedding API 降级策略
    - 当 OpenAI Embedding API 不可用时，使用基于关键词的降级匹配策略
    - _需求：2.2（错误处理）_

  - [ ]* 4.4 编写属性测试：配对条目双语完整性（Property 4）
    - **属性 4：配对条目双语完整性**
    - 验证 pairingStatus 为 "paired" 的 NewsItem，chineseArticle 和 englishArticle 均非 null，且语言标记正确
    - **验证需求：2.1**

  - [ ]* 4.5 编写属性测试：单语言条目正确标记（Property 6）
    - **属性 6：单语言条目正确标记**
    - 验证 pairingStatus 与 chineseArticle/englishArticle 的 null 状态一致
    - **验证需求：2.4**

  - [ ]* 4.6 编写属性测试：新闻主题摘要存在性（Property 7）
    - **属性 7：新闻主题摘要存在性**
    - 验证任意 NewsItem 的 topicSummary 为非空字符串
    - **验证需求：2.5**

  - [ ]* 4.7 编写属性测试：配对文章语义相似度阈值（Property 5）
    - **属性 5：配对文章语义相似度阈值**
    - 验证被配对的中英文文章对的语义相似度分数超过最低阈值
    - **验证需求：2.2**

- [x] 5. 实现 News_Ranker 新闻排序器
  - [x] 5.1 创建 `server/src/services/NewsRanker.ts`，实现重要性排序和筛选
    - 实现 `computeImportanceScore(item)` 方法，基于报道频次、媒体权重（T1 权重高于 T2）和时效性衰减计算综合分数
    - 实现 `rankAndSelect(items, targetCount)` 方法，排序并筛选 Top 10
    - 为每条新闻标注所属领域分类（domain），多领域新闻归入最相关主要领域并标注 secondaryDomains
    - _需求：4.1, 4.2, 5.2, 5.3_

  - [x] 5.2 实现领域覆盖保证逻辑
    - 实现 `ensureDomainCoverage(ranked, minDomains)` 方法
    - 确保输出覆盖 AI、科技、经济、国际政治中至少3个领域
    - 某领域无重要新闻时从其余领域补足10条
    - _需求：4.3, 4.4_

  - [ ]* 5.3 编写属性测试：Top 10 数量保证（Property 10）
    - **属性 10：Top 10 数量保证**
    - 验证候选 ≥10 条时输出恰好10条，不足时输出等于候选数量
    - **验证需求：4.1, 4.4**

  - [ ]* 5.4 编写属性测试：重要性排序正确性（Property 11）
    - **属性 11：重要性排序正确性**
    - 验证输出列表按 importanceScore 降序排列
    - **验证需求：4.2**

  - [ ]* 5.5 编写属性测试：领域覆盖保证（Property 12）
    - **属性 12：领域覆盖保证**
    - 验证候选覆盖 ≥3 个领域时，输出中不同 domain 数量 ≥ 3
    - **验证需求：4.3**

  - [ ]* 5.6 编写属性测试：主次领域分配正确性（Property 13）
    - **属性 13：主次领域分配正确性**
    - 验证 domain 不出现在 secondaryDomains 中，secondaryDomains 无重复值
    - **验证需求：5.2, 5.3**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. 实现 News_Scheduler 定时调度器
  - [x] 7.1 创建 `server/src/services/NewsScheduler.ts`，实现定时任务管理
    - 使用 `node-cron` 配置每天早上9:00触发（cron 表达式 `0 9 * * *`）
    - 实现 `start()`、`stop()`、`triggerUpdate()` 方法
    - `triggerUpdate()` 串联调用 Aggregator → Matcher → Ranker 完整流程
    - 失败后15分钟自动重试，最多3次
    - 完成后记录 `UpdateResult`（completedAt、articlesFetched、newsItemsGenerated）
    - _需求：3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 创建 `server/src/services/NewsStorageService.ts`，实现新闻数据持久化
    - 继承 FileStorageService 模式，以日期为文件名存储每日新闻（`news/YYYY-MM-DD.json`）
    - 实现 `saveDailyNews(dailyNews)`、`getDailyNews(date)`、`getLatestDailyNews()` 方法
    - 所有源不可访问时保留上一次成功的新闻数据
    - _需求：3.4（错误处理）_

  - [ ]* 7.3 编写属性测试：更新结果完整性（Property 9）
    - **属性 9：更新结果完整性**
    - 验证成功的 UpdateResult 中 completedAt 为有效时间戳，articlesFetched 和 newsItemsGenerated 为非负整数，且 newsItemsGenerated ≤ articlesFetched
    - **验证需求：3.4**

  - [ ]* 7.4 编写单元测试：定时任务配置与重试机制
    - 验证 cron 表达式对应每天9:00（需求3.1）
    - 验证失败后15分钟重试，最多3次（需求3.3）
    - 验证3次重试均失败后保留上一次数据（错误处理）
    - _需求：3.1, 3.3_

- [x] 8. 实现 REST API 路由
  - [x] 8.1 创建 `server/src/routes/news.ts`，实现新闻 API 路由
    - `GET /api/news/daily?date=YYYY-MM-DD` - 获取指定日期的每日新闻列表（默认今天）
    - `GET /api/news/:id` - 获取单条新闻详情（含中英文全文）
    - `GET /api/news/daily?date=YYYY-MM-DD&domain=ai` - 按领域筛选新闻
    - `GET /api/news/sources` - 获取所有注册新闻源列表
    - `POST /api/news/trigger` - 手动触发新闻更新
    - _需求：7.1, 7.4, 6.1_

  - [x] 8.2 实现 API 错误处理
    - 无效日期格式返回 400（INVALID_DATE）
    - 无效领域参数返回 400（INVALID_DOMAIN）
    - 请求日期无数据返回 404（NO_DATA）
    - 服务器内部错误返回 500（INTERNAL_ERROR）
    - _需求：7.4（错误处理）_

  - [x] 8.3 在 `server/src/app.ts` 中注册新闻路由，在 `server/src/index.ts` 中初始化 Scheduler
    - _需求：3.1_

  - [ ]* 8.4 编写 API 路由单元测试
    - 在 `server/src/routes/__tests__/news.test.ts` 中测试各端点的正常响应和错误响应
    - 测试无效日期格式、无效领域参数、无数据日期的错误码
    - _需求：7.1, 7.4_

- [x] 9. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 10. 实现前端新闻列表页
  - [x] 10.1 创建 `src/components/NewsFeed/NewsFeed.tsx` 和 `src/components/NewsFeed/NewsFeed.css`
    - 以列表形式展示每日10条 NewsItem，按重要性排序
    - 每条卡片展示新闻主题摘要、领域标签、更新时间
    - 为每篇文章展示媒体名称、原始发布时间和原文链接
    - 原文链接在新窗口打开（`target="_blank" rel="noopener noreferrer"`）
    - _需求：7.1, 7.3, 6.1, 6.2, 6.3_

  - [x] 10.2 创建 `src/components/NewsFeed/DomainFilter.tsx`，实现领域筛选栏
    - 支持按 AI、科技、经济、国际政治四个领域筛选
    - 筛选后仅显示 domain 或 secondaryDomains 包含所选领域的新闻
    - _需求：7.4_

  - [x] 10.3 创建 `src/components/NewsFeed/NewsCard.tsx`，实现单条新闻卡片组件
    - 展示 topicSummary、domain 标签、createdAt 时间
    - 标注中文文章来源和英文文章来源
    - 对于 'zh-only' 或 'en-only' 条目显示相应标记
    - _需求：6.3, 7.3, 2.4_

  - [ ]* 10.4 编写属性测试：来源溯源信息完整性（Property 14）
    - **属性 14：来源溯源信息完整性**
    - 验证展示的 NewsItem 中每个非 null 的 ArticleRef 包含非空的 sourceName、url、publishedAt
    - **验证需求：6.1, 6.3**

  - [ ]* 10.5 编写属性测试：新闻卡片信息完整性（Property 15）
    - **属性 15：新闻卡片信息完整性**
    - 验证渲染的 NewsItem 卡片包含 topicSummary、domain 标签和 createdAt 时间
    - **验证需求：7.3**

  - [ ]* 10.6 编写属性测试：领域筛选正确性（Property 16）
    - **属性 16：领域筛选正确性**
    - 验证筛选后返回的所有 NewsItem 的 domain 或 secondaryDomains 包含筛选条件
    - **验证需求：7.4**

- [x] 11. 实现前端双语并排阅读视图
  - [x] 11.1 创建 `src/components/NewsFeed/NewsDetail.tsx` 和 `src/components/NewsFeed/NewsDetail.css`
    - 用户选择某条 NewsItem 后展示中文文章和英文文章的并排视图
    - 明确标注中文文章来源和英文文章来源
    - 每篇文章展示媒体名称、原始发布时间和原文链接
    - 原文链接在新窗口打开
    - _需求：7.2, 6.1, 6.2, 6.3_

  - [x] 11.2 创建 `src/components/NewsFeed/SourceBadge.tsx`，实现来源标识组件
    - 展示媒体名称和信誉等级标识
    - _需求：6.1, 6.3_

  - [ ]* 11.3 编写 NewsDetail 组件单元测试
    - 测试并排视图正确渲染中英文文章、原文链接在新窗口打开、单语言条目的展示
    - _需求：7.2, 6.2_

- [x] 12. 前端路由集成与页面接入
  - [x] 12.1 在 `src/App.tsx` 中添加新闻页面路由，创建 API 调用服务
    - 创建 `src/services/NewsApiClient.ts`，封装新闻相关 API 调用
    - 在 App 路由中添加新闻列表页和详情页路由
    - _需求：7.1, 7.2_

  - [ ]* 12.2 编写属性测试：新闻源排除非权威来源（Property 18）
    - **属性 18：新闻源排除非权威来源**
    - 验证 Source_Registry 中所有 NewsSource 均为具有编辑审核机制的官方媒体机构
    - **验证需求：1.6, 1.8**

- [x] 13. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了对应的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试使用 `fast-check` 库验证设计文档中的18个正确性属性
- 单元测试覆盖具体示例、边界情况和错误条件
- 所有测试文件按设计文档中的组织结构放置
