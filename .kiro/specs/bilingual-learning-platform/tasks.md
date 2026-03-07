# 实现计划：双语学习平台

## 概述

基于现有 React + Vite 前端和 Express 后端架构，渐进式实现每日简报自动生成、双语对照研习会话、交互式术语收藏与术语库管理三大功能模块。复用现有 NewsAggregator、SourceRegistryService、FileStorageService 等服务，新建 BriefingGenerator、ContentExtractor、TranslationService、StudySessionService、TermService 等后端服务，以及对应的前端页面组件。

## 任务

- [x] 1. 定义数据模型与类型
  - [x] 1.1 在 `server/src/types/briefing.ts` 中定义所有新类型
    - 定义 `BriefingDomain`、`BRIEFING_DOMAIN_LABELS`、`NewsEntry`、`DailyBriefing`、`BriefingUpdateResult`
    - 定义 `StudySession`、`CreateSessionInput`、`StudySessionsFile`
    - 定义 `Term`、`CreateTermInput`、`TermFilters`、`TermsFile`
    - 定义 `BriefingSource`、`BriefingSourceRegistry`、`ExtractedContent`
    - _需求: 1.3, 1.5, 1.6, 3.10, 4.7, 6.2_

  - [x] 1.2 创建 `server/src/data/briefingSources.json` 简报专用来源注册表
    - 为 ai-tech、economy、politics、auto 四个领域各配置至少 2 个权威中文 RSS 源
    - 包含 id、name、url、domain、tier、weight、enabled 字段
    - _需求: 6.2, 6.3, 1.9_

  - [x] 1.3 在 `src/types/briefing.ts` 中定义前端共享类型
    - 镜像后端的 `BriefingDomain`、`NewsEntry`、`DailyBriefing`、`StudySession`、`Term`、`TermFilters` 等类型
    - _需求: 2.3, 3.8, 5.1_

- [x] 2. 实现 ContentExtractor 服务
  - [x] 2.1 创建 `server/src/services/ContentExtractor.ts`
    - 使用 `@mozilla/readability` + `jsdom` 从 URL 提取纯正文
    - 实现 `extractFromUrl(url: string): Promise<ExtractedContent>` 方法
    - 处理 URL 不可访问和正文提取失败的错误场景
    - 返回 title、content（纯文本）、htmlContent（保留段落结构）、siteName、excerpt
    - _需求: 3.4, 3.5, 3.6, 3.7, 6.5_

  - [ ]* 2.2 编写 ContentExtractor 属性测试
    - **Property 7: 内容提取质量**
    - 验证包含 `<article>` 正文和 `<nav>`/`<aside>`/`<footer>` 等非正文元素的 HTML，提取结果应包含正文且不包含非正文元素
    - **验证需求: 3.4, 3.5**

  - [ ]* 2.3 编写 ContentExtractor 单元测试
    - 测试 URL 不可访问、空页面、正常页面提取等场景
    - _需求: 3.6, 3.7_

- [x] 3. 实现 TranslationService 服务
  - [x] 3.1 创建 `server/src/services/TranslationService.ts`
    - 封装 OpenAI API 调用，实现 `translateTitles(titles: string[]): Promise<string[]>` 批量翻译中文标题为英文
    - 翻译失败时使用中文标题作为 fallback
    - _需求: 1.6_

  - [ ]* 3.2 编写 TranslationService 单元测试
    - 测试正常翻译、API 失败 fallback 等场景
    - _需求: 1.6_

- [x] 4. 实现 BriefingStorageService 服务
  - [x] 4.1 创建 `server/src/services/BriefingStorageService.ts`
    - 参照 `NewsStorageService` 模式，以日期为文件名存储简报（`data/briefings/YYYY-MM-DD.json`）
    - 实现 `saveDailyBriefing`、`getDailyBriefing`、`getLatestBriefing`、`getNewsEntry` 方法
    - _需求: 2.6_

  - [ ]* 4.2 编写 BriefingStorageService 属性测试
    - **Property 6: 历史简报检索 round-trip**
    - 验证保存后通过 date 检索返回完全相同的数据
    - **验证需求: 2.6**

- [x] 5. 实现 BriefingGenerator 服务
  - [x] 5.1 创建 `server/src/services/BriefingGenerator.ts`
    - 编排完整简报生成流程：抓取 → 时间窗口过滤 → 按领域分组 → 排序筛选 Top3 → 提取中文正文 → 翻译标题 → 存储
    - 实现 `generateDailyBriefing(date?: string): Promise<DailyBriefing>`
    - 实现 `selectTopArticles(articles, countPerDomain)` 按领域筛选
    - 实现 `enrichWithFullContent(articles)` 通过 ContentExtractor 提取完整中文正文
    - 处理新闻源故障容错：跳过不可访问的源，记录错误日志
    - _需求: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 6.1, 6.4, 6.5_

  - [ ]* 5.2 编写 BriefingGenerator 属性测试 - 字段完整性
    - **Property 1: NewsEntry 字段完整性**
    - 验证所有 NewsEntry 的必填字段均不为空字符串
    - **验证需求: 1.5, 1.6, 6.5, 6.6**

  - [ ]* 5.3 编写 BriefingGenerator 属性测试 - 领域选择约束
    - **Property 2: 领域选择约束**
    - 验证每个领域最多 3 条，不足时不从其他领域补充，domain 一致性
    - **验证需求: 1.3, 1.4**

  - [ ]* 5.4 编写 BriefingGenerator 属性测试 - 时间窗口过滤
    - **Property 3: 时间窗口过滤**
    - 验证保留的文章时间戳在 [since, now] 区间内，过滤掉的在区间外
    - **验证需求: 1.2**

  - [ ]* 5.5 编写 BriefingGenerator 属性测试 - 新闻源故障容错
    - **Property 4: 新闻源故障容错**
    - 验证部分源不可访问时仍返回可访问源的文章，错误列表包含不可访问源
    - **验证需求: 1.8**

  - [ ]* 5.6 编写 BriefingGenerator 属性测试 - 领域分组正确性
    - **Property 5: 领域分组正确性**
    - 验证按 domain 分组后每个分组内 NewsEntry 的 domain 与分组键一致
    - **验证需求: 2.2**

  - [ ]* 5.7 编写 BriefingGenerator 属性测试 - 来源合法性
    - **Property 17: 文章来源合法性**
    - 验证每条 NewsEntry 的 sourceName 对应已注册且启用的新闻源
    - **验证需求: 6.1**

  - [ ]* 5.8 编写 BriefingGenerator 属性测试 - 重要性排序
    - **Property 18: 重要性排序**
    - 验证同一领域的 NewsEntry 按重要性得分降序排列
    - **验证需求: 6.4**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. 实现 BriefingScheduler 服务
  - [x] 7.1 创建 `server/src/services/BriefingScheduler.ts`
    - 参照 `NewsScheduler` 的 cron + 重试模式
    - 每天 09:00 触发 `BriefingGenerator.generateDailyBriefing()`
    - 实现 15 分钟间隔、最多 3 次重试机制
    - 提供 `start()`、`stop()`、`triggerGeneration()`、`executeWithRetry()` 方法
    - _需求: 1.1, 1.7_

  - [ ]* 7.2 编写 BriefingScheduler 单元测试
    - 测试 cron 调度、重试机制（3 次重试后失败）
    - _需求: 1.1, 1.7_

- [x] 8. 实现来源注册表属性测试
  - [ ]* 8.1 编写来源注册表属性测试
    - **Property 16: 来源注册表不变量**
    - 验证每个 BriefingDomain 至少 2 个启用源，每个源的 name/url/domain 不为空
    - **验证需求: 6.2, 6.3**

- [x] 9. 实现 StudySessionService 服务
  - [x] 9.1 创建 `server/src/services/StudySessionService.ts`
    - 使用 FileStorageService 持久化 `{userId}/study-sessions.json`
    - 实现 `createSession`、`getSessions`、`getSession`、`updateSession` 方法
    - 更新英文内容时自动将 status 设为 'completed'
    - _需求: 3.1, 3.8, 3.10_

  - [ ]* 9.2 编写 StudySessionService 属性测试
    - **Property 8: StudySession 持久化 round-trip**
    - 验证创建后读取返回相同数据；更新英文内容后 status 变为 completed
    - **验证需求: 3.8, 3.10**

- [x] 10. 实现 TermService 服务与语境提取工具
  - [x] 10.1 创建 `server/src/services/contextExtractor.ts` 语境原句提取工具函数
    - 实现 `extractSentenceContext(text: string, term: string): string`
    - 从英文文本中提取包含指定术语的完整句子
    - _需求: 4.6_

  - [ ]* 10.2 编写语境原句提取属性测试
    - **Property 9: 语境原句提取**
    - 验证提取的语境原句包含术语子串，且是完整句子
    - **验证需求: 4.6**

  - [x] 10.3 创建 `server/src/services/TermService.ts`
    - 使用 FileStorageService 持久化 `{userId}/terms.json`
    - 实现 `createTerm`（含中文释义必填验证）、`getTerms`（支持领域筛选和关键词搜索）、`updateTerm`、`deleteTerm`
    - 返回结果按 createdAt 降序排列
    - _需求: 4.7, 4.8, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

  - [ ]* 10.4 编写 TermService 属性测试 - 术语领域默认值
    - **Property 10: 术语领域默认值**
    - 验证创建术语时默认 domain 等于 NewsEntry 的 domain
    - **验证需求: 4.5**

  - [ ]* 10.5 编写 TermService 属性测试 - 中文释义必填验证
    - **Property 11: 术语中文释义必填验证**
    - 验证 chinese 为空或纯空白时拒绝创建并返回验证错误
    - **验证需求: 4.8**

  - [ ]* 10.6 编写 TermService 属性测试 - CRUD round-trip
    - **Property 12: 术语 CRUD round-trip**
    - 验证创建后读取相同、更新后反映更改、删除后返回空
    - **验证需求: 4.7, 5.5, 5.6**

  - [ ]* 10.7 编写 TermService 属性测试 - 领域筛选
    - **Property 13: 术语领域筛选**
    - 验证筛选结果中所有术语的 domain 等于筛选条件
    - **验证需求: 5.2**

  - [ ]* 10.8 编写 TermService 属性测试 - 关键词搜索
    - **Property 14: 术语关键词搜索**
    - 验证搜索结果中每条术语的 english 或 chinese 包含关键词
    - **验证需求: 5.3**

  - [ ]* 10.9 编写 TermService 属性测试 - 排序
    - **Property 15: 术语排序**
    - 验证返回结果按 createdAt 降序排列
    - **验证需求: 5.7**

- [x] 11. 检查点 - 确保所有后端服务测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 12. 实现后端 API 路由
  - [x] 12.1 创建 `server/src/routes/briefing.ts` 简报路由
    - `GET /api/briefing/daily?date=YYYY-MM-DD` 获取指定日期简报
    - `GET /api/briefing/entry/:entryId?date=YYYY-MM-DD` 获取单条新闻条目
    - `POST /api/briefing/trigger` 手动触发简报生成
    - _需求: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 12.2 创建 `server/src/routes/studySessions.ts` 研习会话路由
    - `POST /api/study-sessions` 创建研习会话
    - `GET /api/study-sessions` 获取用户所有研习会话
    - `GET /api/study-sessions/:id` 获取单个研习会话
    - `PUT /api/study-sessions/:id` 更新研习会话
    - `POST /api/study-sessions/:id/extract` 调用 ContentExtractor 提取英文正文
    - _需求: 3.1, 3.4, 3.6, 3.7, 3.10_

  - [x] 12.3 创建 `server/src/routes/terms.ts` 术语路由
    - `POST /api/terms` 创建术语
    - `GET /api/terms?domain=&keyword=` 获取术语列表
    - `GET /api/terms/:id` 获取术语详情
    - `PUT /api/terms/:id` 更新术语
    - `DELETE /api/terms/:id` 删除术语
    - _需求: 4.7, 4.8, 5.1, 5.2, 5.3, 5.5, 5.6_

  - [x] 12.4 在 `server/src/app.ts` 中注册新路由并初始化服务
    - 注册 briefing、study-sessions、terms 三组路由
    - 初始化 BriefingScheduler 并启动定时任务
    - _需求: 1.1_

- [x] 13. 实现前端 API 客户端
  - [x] 13.1 创建 `src/services/BriefingApiClient.ts`
    - 封装所有简报、研习会话、术语相关的 API 调用
    - 包含错误处理和类型安全的请求/响应
    - _需求: 2.1, 3.1, 5.1_

- [x] 14. 实现 DailyBriefing 前端页面
  - [x] 14.1 创建 `src/components/DailyBriefing/` 目录及组件
    - `DailyBriefingPage.tsx`：简报首页容器，管理日期状态
    - `DomainSection.tsx`：单个领域的新闻条目列表
    - `NewsEntryCard.tsx`：新闻卡片（中英标题、摘要、精读按钮）
    - `DatePicker.tsx`：日期选择器
    - 简报未生成时显示"今日简报正在生成中"提示
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 14.2 创建 `src/components/DailyBriefing/DailyBriefing.css` 样式
    - 按领域分组的卡片布局
    - 响应式设计
    - _需求: 2.2, 2.3_

- [x] 15. 实现 StudySession 前端页面
  - [x] 15.1 创建 `src/components/StudySession/` 目录及组件
    - `StudySessionPage.tsx`：研习会话容器
    - `ChinesePanel.tsx`：左栏中文原文面板
    - `EnglishPanel.tsx`：右栏英文面板（URL 输入 + 正文展示）
    - `UrlInputForm.tsx`：英文报道 URL 输入表单
    - `ComparisonView.tsx`：双栏对照视图，支持独立滚动
    - 处理 URL 提取失败时的错误提示和手动粘贴入口
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9_

  - [x] 15.2 创建 `src/components/StudySession/StudySession.css` 样式
    - 双栏并排布局，独立滚动
    - _需求: 3.8, 3.9_

- [x] 16. 实现交互式术语收藏组件
  - [x] 16.1 创建术语收藏交互组件
    - `src/components/StudySession/TextSelectionPopup.tsx`：划选弹出"收藏为术语"按钮
    - `src/components/StudySession/TermEditForm.tsx`：术语编辑表单 Modal
    - 自动填入划选英文内容、自动捕获语境原句、默认选中当前领域
    - 保存成功后在英文原文中高亮已收藏术语
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 17. 实现 TermLibrary 前端页面
  - [x] 17.1 创建 `src/components/TermLibrary/` 目录及组件
    - `TermLibraryPage.tsx`：术语库容器
    - `TermList.tsx`：术语列表
    - `TermCard.tsx`：术语卡片
    - `TermDetail.tsx`：术语详情面板（含编辑和删除功能）
    - `TermFilters.tsx`：领域筛选 + 搜索栏
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 17.2 创建 `src/components/TermLibrary/TermLibrary.css` 样式
    - 列表布局、筛选栏、详情面板样式
    - _需求: 5.1_

- [x] 18. 路由集成与页面导航
  - [x] 18.1 在 `src/App.tsx` 中集成新页面路由
    - 添加 DailyBriefing 作为首页（或新增导航入口）
    - 添加 StudySession 页面路由
    - 添加 TermLibrary 页面路由
    - 确保从简报页面点击"精读"可导航到研习会话页面
    - 确保导航栏包含术语库入口
    - _需求: 2.1, 2.4, 3.1, 5.1_

- [x] 19. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 属性测试验证设计文档中定义的 18 个正确性属性
- 检查点确保增量验证，避免问题累积
- 后端服务优先实现，前端页面依赖后端 API
