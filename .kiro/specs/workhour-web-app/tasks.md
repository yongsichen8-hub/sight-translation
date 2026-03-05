# 实现计划：工时管理 Web 应用

## 概述

基于前后端分离架构（React + Express + TypeScript）实现工时管理 Web 应用。后端复用 `feishu-workhour-bot/` 中的 BitableService、TrackerService、FormValidator 服务代码，前端使用 Vite + React + Recharts。实现按照"后端基础设施 → 服务层 → API 路由 → 前端页面 → 集成联调"的顺序推进。

## Tasks

- [x] 1. 搭建后端项目结构与配置
  - [x] 1.1 初始化 `workhour-web-app/server/` 项目
    - 创建 `package.json`（依赖：express、cors、cookie-parser、jsonwebtoken、axios、dotenv、typescript、vitest、fast-check）
    - 创建 `tsconfig.json`
    - 创建 `src/index.ts` 入口文件，配置 Express 应用（CORS、cookie-parser、JSON body parser、错误处理中间件）
    - _Requirements: 9.1, 9.3_

  - [x] 1.2 实现环境变量配置模块 `server/src/config/index.ts`
    - 定义所有必需环境变量：FEISHU_APP_ID、FEISHU_APP_SECRET、BITABLE_APP_TOKEN、INTERPRETATION_TABLE_ID、TRANSLATION_TABLE_ID、JWT_SECRET、PORT、CORS_ORIGIN、FEISHU_REDIRECT_URI
    - 实现 `validateConfig` 函数：启动时验证所有必需变量，缺失时输出变量名并终止进程
    - _Requirements: 9.1, 9.2_

  - [ ]* 1.3 编写 Property 15 属性测试：环境变量验证
    - **Property 15: 环境变量验证**
    - 使用 fast-check 生成必需环境变量的随机子集缺失场景，验证 `validateConfig` 抛出错误且错误信息包含所有缺失变量名
    - **Validates: Requirements 9.2**

- [x] 2. 复用服务代码与类型定义
  - [x] 2.1 复制并适配类型定义 `server/src/types/index.ts`
    - 从 `feishu-workhour-bot/src/types/feishu.ts` 复制 BitableConfig、ProjectType 等类型
    - 新增 Web 应用类型：JwtPayload、UserInfo、TimeRecordSubmitRequest、StatsResponse、ApiResponse
    - 新增 TimeRecord、Translator、Project 接口
    - _Requirements: 8.10, 9.4_

  - [x] 2.2 复制并适配 `server/src/services/BitableService.ts`
    - 从 `feishu-workhour-bot/src/services/BitableService.ts` 复制
    - 确保 `getOngoingProjects()`、`getOngoingProjectsByType(type)`、`updateWorkhourStats()` 方法可用
    - 调整 import 路径指向新的类型文件
    - _Requirements: 2.1, 4.2, 9.4_

  - [x] 2.3 复制并适配 `server/src/services/TrackerService.ts`
    - 从 `feishu-workhour-bot/src/services/TrackerService.ts` 复制
    - 确保 `addTimeRecord`、`findOrCreateTranslator`、`getProjectTotalTime`、`getAllTimeRecords`、`getTimeRecordsByProject`、`getTimeRecordsByTranslator` 方法可用
    - 如缺少 `getTimeRecordsByTranslator` 或按日期范围筛选方法，需补充实现
    - _Requirements: 3.7, 5.1, 5.2, 9.4_

  - [x] 2.4 复制并适配 `server/src/validators/FormValidator.ts`
    - 从 `feishu-workhour-bot/src/validators/FormValidator.ts` 复制
    - 调整 import 路径
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 9.4_

- [x] 3. 实现认证服务与中间件
  - [x] 3.1 实现 `server/src/services/AuthService.ts`
    - `getAuthorizationUrl(redirectUri)`: 生成飞书 OAuth 授权 URL，包含随机 state 参数防 CSRF
    - `handleCallback(code, state)`: 交换 access_token → 调用飞书 API 获取用户信息（open_id、name、avatar）→ 调用 TrackerService.findOrCreateTranslator → 签发 JWT（有效期 7 天）
    - `verifyToken(token)`: 验证并解码 JWT
    - 参考 `server/src/routes/auth.ts` 中已有的飞书 OAuth 模式
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 3.2 实现 `server/src/middleware/authMiddleware.ts`
    - 从请求 Cookie 中提取 JWT，验证有效性
    - 有效时将用户信息挂载到 `req.user`
    - 无效或缺失时返回 401 状态码
    - _Requirements: 1.7, 8.9_

  - [ ]* 3.3 编写 Property 1 属性测试：JWT 令牌 Round-Trip
    - **Property 1: JWT 令牌 Round-Trip**
    - 使用 fast-check 生成随机 userId、name、avatar，创建 JWT 后验证解码得到等价 payload
    - **Validates: Requirements 1.3**

  - [ ]* 3.4 编写 Property 2 属性测试：OAuth 授权 URL 包含 State 参数
    - **Property 2: OAuth 授权 URL 包含 State 参数**
    - 多次调用 `getAuthorizationUrl`，验证每次 URL 包含非空 state 且各次 state 互不相同
    - **Validates: Requirements 1.5**

  - [ ]* 3.5 编写 Property 13 属性测试：认证中间件拒绝未认证请求
    - **Property 13: 认证中间件拒绝未认证请求**
    - 使用 fast-check 生成随机无效/缺失 token，验证中间件返回 401
    - **Validates: Requirements 8.9**

- [x] 4. Checkpoint - 确保后端基础设施测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 5. 实现后端 API 路由
  - [x] 5.1 实现认证路由 `server/src/routes/auth.ts`
    - GET /api/auth/feishu：发起 OAuth 授权，返回授权 URL
    - GET /api/auth/feishu/callback：处理回调，交换 token，设置 JWT Cookie（HttpOnly、SameSite=Lax、Max-Age=7天）
    - GET /api/auth/me：获取当前登录用户信息（需认证）
    - POST /api/auth/logout：清除 Cookie 退出登录
    - 所有响应使用统一 JSON 格式 `{ success, data?, error? }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.10_

  - [x] 5.2 实现项目路由 `server/src/routes/projects.ts`
    - GET /api/projects：调用 BitableService 获取进行中项目，按口译/笔译分组返回
    - 支持 type 查询参数筛选
    - 飞书 API 失败时返回 502 + 错误信息
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 8.5, 8.10_

  - [x] 5.3 实现工时记录路由 `server/src/routes/timeRecords.ts`
    - POST /api/time-records：使用 FormValidator 验证 → TrackerService.addTimeRecord 写入 → 计算项目总工时 → BitableService.updateWorkhourStats 回写飞书
    - 本地写入成功但飞书同步失败时返回 syncStatus: 'partial'
    - GET /api/time-records：支持 translatorId、projectId、startDate、endDate 参数筛选
    - 译员只能查看自己的记录（数据隔离）
    - _Requirements: 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 5.4, 8.6, 8.7, 8.10_

  - [x] 5.4 实现统计路由 `server/src/routes/stats.ts`
    - GET /api/stats：从 TrackerService 读取记录，计算总工时、口译/笔译工时、译员人数、按译员分组、按项目分组
    - 支持 startDate、endDate 参数筛选
    - _Requirements: 7.1, 8.8, 8.10_

  - [x] 5.5 在 `server/src/index.ts` 中注册所有路由并添加全局错误处理中间件
    - 挂载 /api/auth、/api/projects（需认证）、/api/time-records（需认证）、/api/stats（需认证）
    - 统一错误响应格式
    - _Requirements: 8.9, 8.10_

  - [ ]* 5.6 编写 Property 14 属性测试：统一 API 响应格式
    - **Property 14: 统一 API 响应格式**
    - 验证所有 API 响应包含 boolean 类型 success 字段，success=true 时有 data，success=false 时有 error
    - **Validates: Requirements 8.10**

- [x] 6. 实现 TrackerService 扩展方法与属性测试
  - [x] 6.1 扩展 TrackerService 支持筛选与统计
    - 实现按日期范围筛选方法 `getTimeRecordsByDateRange(startDate, endDate)`
    - 实现组合筛选方法 `queryTimeRecords(filters: { translatorId?, projectId?, startDate?, endDate? })`
    - 实现统计聚合方法 `getStats(startDate?, endDate?)`：返回 totalTime、interpretationTime、translationTime、translatorCount、byTranslator、byProject
    - _Requirements: 6.2, 6.3, 7.1, 8.7, 8.8_

  - [ ]* 6.2 编写 Property 7 属性测试：工时记录持久化 Round-Trip
    - **Property 7: 工时记录持久化 Round-Trip**
    - 使用 fast-check 生成随机 TimeRecord，写入后读取验证字段一致
    - **Validates: Requirements 3.7**

  - [ ]* 6.3 编写 Property 8 属性测试：项目总工时聚合
    - **Property 8: 项目总工时聚合**
    - 使用 fast-check 生成随机工时记录集合，验证 `getProjectTotalTime` 返回值等于 time 字段之和
    - **Validates: Requirements 4.1, 4.4, 6.5**

  - [ ]* 6.4 编写 Property 9 属性测试：译员查找或创建幂等性
    - **Property 9: 译员查找或创建幂等性**
    - 使用 fast-check 生成随机 open_id 和 name，验证首次创建、再次调用返回同一记录
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 6.5 编写 Property 10 属性测试：译员数据隔离
    - **Property 10: 译员数据隔离**
    - 使用 fast-check 生成两组随机译员和记录，验证按译员查询时不会返回其他译员的记录
    - **Validates: Requirements 5.4**

  - [ ]* 6.6 编写 Property 11 属性测试：工时记录筛选正确性
    - **Property 11: 工时记录筛选正确性**
    - 使用 fast-check 生成随机记录集合和筛选条件，验证结果中每条记录满足条件且无遗漏
    - **Validates: Requirements 6.2, 6.3, 7.4**

  - [ ]* 6.7 编写 Property 12 属性测试：统计数据聚合正确性
    - **Property 12: 统计数据聚合正确性**
    - 使用 fast-check 生成随机工时记录集合，验证 totalTime = interpretationTime + translationTime，translatorCount 等于去重译员数
    - **Validates: Requirements 7.1**

- [x] 7. Checkpoint - 确保后端 API 和服务层测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 8. 搭建前端项目结构
  - [x] 8.1 初始化 `workhour-web-app/client/` 项目
    - 使用 Vite + React + TypeScript 模板
    - 创建 `package.json`（依赖：react、react-dom、react-router-dom、recharts、axios）
    - 创建 `vite.config.ts`（配置 proxy 代理 /api 到后端）
    - 创建 `tsconfig.json`
    - 创建 `index.html`
    - _Requirements: 9.3_

  - [x] 8.2 实现 API 客户端 `client/src/services/api.ts`
    - 封装 axios 实例，baseURL 指向后端
    - 统一处理 401 响应（重定向到登录页）
    - 封装各 API 调用方法：getAuthUrl、getMe、logout、getProjects、submitTimeRecords、getTimeRecords、getStats
    - _Requirements: 8.1-8.10_

  - [x] 8.3 实现认证上下文 `client/src/context/AuthContext.tsx`
    - 提供 AuthContext：user、loading、login、logout
    - 应用加载时调用 GET /api/auth/me 检查登录状态
    - login 方法调用 getAuthUrl 后重定向到飞书授权页
    - logout 方法调用 POST /api/auth/logout 并清除状态
    - _Requirements: 1.1, 1.7_

  - [x] 8.4 实现路由与应用框架 `client/src/App.tsx`
    - 配置 React Router：/ → 工时填写页、/admin → 管理页、/analytics → 数据分析页、/auth/callback → OAuth 回调处理、/login → 登录页
    - 实现 ProtectedRoute 组件：未登录时重定向到登录页
    - 实现 AuthCallback 组件：处理 OAuth 回调，调用后端 callback 接口后跳转
    - 实现导航栏：显示用户姓名头像、页面切换链接、退出按钮
    - _Requirements: 1.1, 1.3, 5.3_

- [x] 9. 实现工时填写页面
  - [x] 9.1 实现 `client/src/components/TimesheetPage.tsx`
    - 页面顶部显示当前登录译员姓名和头像
    - 口译区域：项目下拉选择框（从 GET /api/projects 动态加载）+ 工时输入框（分钟，正整数）
    - 笔译区域：项目下拉选择框 + 工时输入框
    - 表单验证：复用 FormValidator 逻辑（前端侧验证），工时非正整数时显示错误提示，项目-工时配对不完整时提示，至少填写一项
    - 提交按钮：调用 POST /api/time-records
    - 成功时显示提交成功提示并清空表单，失败时显示错误提示并保留数据
    - 无进行中项目时显示"暂无进行中的项目"提示
    - 飞书 API 失败时显示错误提示 + 重试按钮
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9, 5.3_

  - [ ]* 9.2 编写 Property 3 属性测试：项目过滤与分组
    - **Property 3: 项目过滤与分组**
    - 使用 fast-check 生成随机项目列表，验证过滤后每个项目状态为"进行中"，口译/笔译分组正确，无遗漏
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 9.3 编写 Property 4 属性测试：表单至少填写一项验证
    - **Property 4: 表单至少填写一项验证**
    - 使用 fast-check 生成随机表单数据，验证空表单被拒绝、至少一项完整时被接受
    - **Validates: Requirements 3.3**

  - [ ]* 9.4 编写 Property 5 属性测试：工时正整数验证
    - **Property 5: 工时正整数验证**
    - 使用 fast-check 生成随机数字和字符串，验证 isPositiveInteger 对非正整数返回 false、正整数返回 true
    - **Validates: Requirements 3.4**

  - [ ]* 9.5 编写 Property 6 属性测试：项目-工时配对验证
    - **Property 6: 项目-工时配对验证**
    - 使用 fast-check 生成随机项目/工时组合，验证配对不完整时报错、完整且合法时通过
    - **Validates: Requirements 3.5, 3.6**

- [x] 10. 实现管理页面
  - [x] 10.1 实现 `client/src/components/AdminPage.tsx`
    - 筛选栏：译员姓名输入框、项目名称输入框、项目类型下拉（全部/口译/笔译）、日期范围选择器（开始日期、结束日期）
    - 工时记录表格：列包含译员姓名、项目名称、项目类型、工时（分钟）、提交日期
    - 调用 GET /api/time-records 获取数据，传递筛选参数
    - 显示每个项目的工时汇总（所有译员工时总和）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. 实现数据分析页面
  - [x] 11.1 实现 `client/src/components/AnalyticsPage.tsx`
    - 统计概览卡片：总工时、口译总工时、笔译总工时、译员人数
    - 按译员分组柱状图（Recharts BarChart）
    - 按项目分组柱状图（Recharts BarChart）
    - 口译/笔译占比饼图（Recharts PieChart）
    - 时间范围筛选器：开始日期、结束日期，筛选后重新请求 GET /api/stats
    - 调用 GET /api/stats 获取统计数据
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. 实现登录页面与样式
  - [x] 12.1 实现 `client/src/components/LoginPage.tsx`
    - 显示应用名称和飞书登录按钮
    - 点击按钮调用 AuthContext.login 发起 OAuth
    - 授权失败时显示错误提示
    - _Requirements: 1.1, 1.4_

  - [x] 12.2 添加全局样式和页面布局
    - 创建全局 CSS 或使用 CSS Modules
    - 实现响应式布局
    - 统一表单、表格、卡片、按钮样式
    - _Requirements: 3.1, 6.4, 7.1_

- [x] 13. 集成联调与最终验证
  - [x] 13.1 配置前后端联调
    - 确保 Vite proxy 正确代理 /api 请求到后端
    - 创建 `.env` 示例文件，包含所有必需环境变量说明
    - 更新 `README.md`：项目说明、环境变量配置、启动命令（前端 `npm run dev`、后端 `npm run dev`）
    - _Requirements: 9.1, 9.2_

  - [x] 13.2 在 `server/src/index.ts` 中完成所有路由注册和中间件串联
    - 确保认证中间件正确保护 /api/projects、/api/time-records、/api/stats 路由
    - 确保全局错误处理中间件捕获未处理异常
    - _Requirements: 8.9, 8.10_

- [x] 14. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## Notes

- 标记 `*` 的子任务为可选，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 后端服务代码从 `feishu-workhour-bot/` 复制并适配，避免跨项目引用
- 属性测试使用 fast-check，验证设计文档中定义的正确性属性
- 管理员分享链接为线下操作，不在平台内实现
