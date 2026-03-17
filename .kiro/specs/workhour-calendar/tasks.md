# 实现计划：工作时间追踪日历应用

## 概述

基于需求文档和技术设计文档，将功能拆分为增量式编码任务。后端优先搭建数据库和核心服务，前端逐步构建页面和交互，最后集成 AI 总结和提醒功能。所有代码使用 TypeScript，前端位于 `calendar/client/`，后端位于 `calendar/server/`。

## 任务

- [x] 1. 搭建项目基础结构和配置
  - [x] 1.1 初始化后端项目 `calendar/server/`
    - 创建 `package.json`，安装依赖：express, better-sqlite3, bcrypt, jsonwebtoken, cookie-parser, cors, dotenv
    - 安装开发依赖：typescript, @types/express, @types/better-sqlite3, @types/bcrypt, @types/jsonwebtoken, @types/cookie-parser, @types/cors, vitest, fast-check
    - 创建 `tsconfig.json` 和 `vitest.config.ts`
    - _需求：9.1, 9.2, 9.3_

  - [x] 1.2 创建后端配置模块 `calendar/server/src/config/index.ts`
    - 从环境变量读取 JWT_SECRET、DEEPSEEK_API_KEY、PORT（默认 3200）、DATABASE_PATH（默认 ./data/calendar.db）
    - 若 JWT_SECRET 未配置则输出缺失变量名称并终止启动
    - _需求：9.5, 9.7_

  - [ ]* 1.3 编写配置模块属性测试
    - **属性 27：环境变量配置读取**
    - **验证需求：9.5**

  - [x] 1.4 初始化前端项目 `calendar/client/`
    - 使用 Vite + React + TypeScript 模板创建项目
    - 安装依赖：react-router-dom
    - 安装开发依赖：vitest, @testing-library/react, @testing-library/jest-dom, fast-check, jsdom
    - 创建 `vitest.config.ts`
    - _需求：9.1, 9.4_

  - [x] 1.5 创建共享类型定义
    - 后端 `calendar/server/src/types/index.ts`：定义 User, Category, WorkEntry, Objective, KeyResult, InspirationEntry, InspirationCategory, Summary 及所有 DTO 接口
    - 前端 `calendar/client/src/types/index.ts`：定义前端使用的类型（与后端响应对应）
    - _需求：3.6, 11.5, 12.6_

- [x] 2. 实现数据库层和认证服务
  - [x] 2.1 创建数据库初始化模块 `calendar/server/src/db/index.ts`
    - 使用 better-sqlite3 连接 SQLite
    - 启动时自动创建所有表结构（users, categories, work_entries, objectives, key_results, inspiration_categories, inspiration_entries, summaries）
    - 创建 `idx_work_entries_user_date_slot` 索引
    - _需求：7.1, 7.4, 9.3, 9.6_

  - [x] 2.2 实现认证服务 `calendar/server/src/services/authService.ts`
    - register：验证用户名长度 3-20、密码长度 6-30，bcrypt 哈希密码，插入用户，生成 JWT（有效期 7 天）
    - login：查询用户，bcrypt.compare 验证密码，生成 JWT
    - verifyToken：解析 JWT 返回 userId 和 username
    - 用户名已存在返回错误，登录失败统一返回"用户名或密码错误"
    - _需求：1.2, 1.3, 1.5, 1.7, 1.8_

  - [x] 2.3 实现认证中间件 `calendar/server/src/middleware/authMiddleware.ts`
    - 从 HTTP-only Cookie 中读取 JWT 令牌
    - 验证令牌有效性，无效或过期返回 401
    - 将 userId 和 username 注入 req 对象
    - _需求：1.7, 1.10_

  - [ ]* 2.4 编写认证服务属性测试
    - **属性 1：用户名和密码长度验证**
    - **属性 2：用户名唯一性约束**
    - **属性 3：密码哈希安全性（往返属性）**
    - **属性 4：JWT 令牌往返验证**
    - **属性 5：无效令牌拒绝**
    - **属性 6：登录错误信息不泄露**
    - **验证需求：1.2, 1.3, 1.5, 1.7, 1.8, 1.10**

  - [x] 2.5 实现认证路由 `calendar/server/src/routes/authRoutes.ts`
    - POST /api/auth/register - 用户注册
    - POST /api/auth/login - 用户登录，JWT 设置到 HTTP-only Cookie
    - POST /api/auth/logout - 清除 Cookie
    - _需求：1.1, 1.5, 1.6, 1.7, 1.9_

- [x] 3. 检查点 - 确保后端基础设施和认证功能正常
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 实现分类管理服务
  - [x] 4.1 实现分类服务 `calendar/server/src/services/categoryService.ts`
    - ensureDefaults：为新用户创建默认分类（高管、培训、语言组、自我提升、其他），"其他"标记 isDefault=true
    - list：查询用户分类列表，包含 workEntryCount 和 objectiveCount
    - create：新增分类，分配颜色
    - update：编辑分类名称
    - delete：检查关联记录，支持迁移到目标分类或标记为"其他"，禁止删除默认分类
    - 颜色分配使用预定义柔和色板（淡粉、淡蓝、淡绿、淡黄、淡紫等）
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 4.2 编写分类服务属性测试
    - **属性 10：分类创建往返**
    - **属性 16：分类使用次数准确性**
    - **属性 17：分类编辑后引用完整性**
    - **属性 18：分类删除迁移**
    - **属性 19："其他"分类不可删除**
    - **属性 20：分类颜色唯一性**
    - **验证需求：3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8**

  - [x] 4.3 实现分类路由 `calendar/server/src/routes/categoryRoutes.ts`
    - GET /api/categories - 获取分类列表
    - POST /api/categories - 新增分类
    - PUT /api/categories/:id - 编辑分类
    - DELETE /api/categories/:id - 删除分类（query 参数 migrateToId）
    - _需求：5.1, 5.2, 5.3, 5.4_

- [x] 5. 实现工作条目服务
  - [x] 5.1 实现工作条目服务 `calendar/server/src/services/workEntryService.ts`
    - getByWeek：按周起始日期查询该周所有工作条目
    - getByDateRange：按日期范围查询工作条目
    - save：批量保存工作条目（含 userId、date、timeSlot、categoryId、subCategory、description）
    - delete：删除工作条目，验证 userId 一致性，不一致返回 403
    - _需求：3.6, 7.2, 7.3_

  - [ ]* 5.2 编写工作条目服务属性测试
    - **属性 9：工作条目持久化往返**
    - **属性 21：数据用户隔离**
    - **属性 22：跨用户写入拒绝**
    - **验证需求：3.6, 7.2, 7.3**

  - [x] 5.3 实现工作条目路由 `calendar/server/src/routes/workEntryRoutes.ts`
    - GET /api/work-entries?week= - 获取工作条目
    - POST /api/work-entries - 批量保存工作条目
    - DELETE /api/work-entries/:id - 删除工作条目
    - _需求：3.6_

- [x] 6. 实现 OKR 服务
  - [x] 6.1 实现 OKR 服务 `calendar/server/src/services/okrService.ts`
    - getByQuarter：按季度查询 Objective 及其 Key_Result
    - createObjective：创建 Objective，验证 categoryId 不指向"其他"分类
    - updateObjective / deleteObjective：编辑和删除 Objective（级联删除 Key_Result）
    - createKeyResult / updateKeyResult / deleteKeyResult：Key_Result CRUD
    - _需求：11.2, 11.3, 11.4, 11.5, 11.6, 11.8_

  - [ ]* 6.2 编写 OKR 服务属性测试
    - **属性 29：OKR 数据 CRUD 往返**
    - **属性 30：Objective 不可关联"其他"分类**
    - **验证需求：11.2, 11.3, 11.4, 11.5, 11.8**

  - [x] 6.3 实现 OKR 路由 `calendar/server/src/routes/okrRoutes.ts`
    - GET /api/okr?quarter= - 获取 OKR 数据
    - POST/PUT/DELETE /api/okr/objectives - Objective CRUD
    - POST/PUT/DELETE /api/okr/key-results - Key Result CRUD
    - _需求：11.2, 11.3, 11.4, 11.5_

- [x] 7. 实现灵感与待办服务
  - [x] 7.1 实现灵感服务 `calendar/server/src/services/inspirationService.ts`
    - list：查询灵感条目，支持按 categoryId 筛选，按 createdAt 降序排列
    - create / update / delete：灵感条目 CRUD
    - 灵感分类 CRUD：ensureDefaults 创建默认分类（工作、学习、项目、个人、其他）
    - 待办完成状态切换
    - _需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ]* 7.2 编写灵感服务属性测试
    - **属性 31：灵感条目按分类筛选**
    - **属性 32：灵感条目 CRUD 往返**
    - **属性 33：待办完成状态切换**
    - **属性 34：灵感条目按时间倒序**
    - **验证需求：12.1, 12.2, 12.5, 12.6, 12.8**

  - [x] 7.3 实现灵感路由 `calendar/server/src/routes/inspirationRoutes.ts`
    - GET/POST/PUT/DELETE /api/inspirations - 灵感条目 CRUD
    - GET/POST/PUT/DELETE /api/inspiration-categories - 灵感分类 CRUD
    - _需求：12.1, 12.2, 12.3_

- [x] 8. 实现 AI 总结服务
  - [x] 8.1 实现 AI 总结服务 `calendar/server/src/services/aiSummaryService.ts`
    - 日期范围计算：根据总结类型（daily/weekly/monthly/quarterly）计算查询日期范围
    - 数据准备：按 Category 分组工作条目，"其他"分类单独归类为"非 OKR 相关工作"
    - OKR 匹配：通过 categoryId 匹配 Objective 与 Work_Entry，分析推进情况
    - 调用 DeepSeek API 生成总结，包含"OKR 推进分析"章节
    - 保存总结记录，支持查询历史总结
    - API 调用失败返回"AI 总结生成失败，请稍后重试"
    - _需求：6.1-6.14_

  - [ ]* 8.2 编写 AI 总结服务属性测试
    - **属性 23：AI 总结日期范围计算**
    - **属性 24：AI 数据准备分组与"其他"分离**
    - **属性 25：OKR 与工作条目的 Category 匹配**
    - **属性 26：总结记录持久化往返**
    - **验证需求：6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.12**

  - [x] 8.3 实现总结路由 `calendar/server/src/routes/summaryRoutes.ts`
    - POST /api/summaries/generate - 生成 AI 总结
    - GET /api/summaries - 获取历史总结列表
    - GET /api/summaries/:id - 获取总结详情
    - _需求：6.1, 6.12_

- [x] 9. 搭建后端 Express 应用入口并集成所有路由
  - 创建 `calendar/server/src/app.ts`：配置 Express、cookie-parser、cors、JSON 解析
  - 创建 `calendar/server/src/index.ts`：启动服务器，调用数据库初始化
  - 注册所有路由：auth、categories、work-entries、okr、inspirations、inspiration-categories、summaries
  - 配置全局错误处理中间件（ValidationError → 400, AuthError → 401, ForbiddenError → 403, NotFoundError → 404）
  - 创建自定义错误类 `calendar/server/src/errors/index.ts`
  - _需求：9.2, 9.6_

- [x] 10. 检查点 - 确保后端所有服务和路由正常工作
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 11. 实现前端基础框架和认证页面
  - [x] 11.1 创建前端 API Client `calendar/client/src/api/client.ts`
    - 封装 fetch 请求，自动携带 credentials: 'include'
    - 统一处理 401 响应跳转登录页
    - 实现 auth、workEntries、categories、okr、inspirations、inspirationCategories、summaries 各模块方法
    - _需求：1.7, 1.10_

  - [x] 11.2 创建前端路由和导航栏
    - 配置 React Router：/login, /register, /calendar, /okr, /inspiration, /categories
    - 实现 NavigationBar 组件：日历、OKR、灵感三个导航入口，图标加文字，高亮当前页
    - 默认路由重定向到 /calendar
    - 日杂风格设计：圆角、柔和配色、图标
    - _需求：10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.3 实现登录和注册页面
    - LoginForm：用户名、密码输入框、登录按钮，错误提示
    - RegisterForm：用户名、密码、确认密码输入框、注册按钮
    - 前端验证：密码与确认密码一致性检查，显示"两次密码输入不一致"
    - 注册成功自动跳转日历页
    - _需求：1.1, 1.4, 1.5, 1.6, 1.8, 1.9_

  - [x] 11.4 创建全局样式和日杂风格主题
    - 定义 CSS 变量：奶油白背景、柔和暖色调、圆角卡片、充足留白
    - 引入圆润中文字体（思源黑体或类似）
    - 分类颜色标签样式（淡粉、淡蓝、淡绿、淡黄、淡紫等）
    - 按钮和卡片的阴影与过渡动画
    - 确保 1280px 及以上宽度正常显示
    - _需求：8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 12. 实现日历视图页面
  - [x] 12.1 创建前端日期工具函数 `calendar/client/src/utils/dateUtils.ts`
    - getWeekRange：计算给定日期所在周的周一至周五日期范围
    - getNextWeek / getPrevWeek：周导航计算
    - getQuarter：计算日期所属季度字符串
    - TIME_SLOTS 常量：9:00-10:00 至 18:00-18:30 共 10 个时间段
    - formatDateRange：格式化周日期范围显示文字
    - _需求：2.1, 2.2, 2.3_

  - [ ]* 12.2 编写日期工具函数属性测试
    - **属性 7：周日期范围计算**
    - **属性 8：周导航往返**
    - **属性 28：季度计算**
    - **验证需求：2.2, 2.3, 11.1**

  - [x] 12.3 实现 CalendarPage 组件
    - WeekNavigator：显示当前周日期范围，上一周/下一周按钮
    - CalendarGrid：5 列（周一至周五）× 10 行（时间段）表格
    - TimeSlotCell：显示该时间段的工作条目（分类颜色标签 + 简要描述），支持多条目展示
    - 当前日期列高亮标识
    - 点击单元格打开编辑弹窗
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 12.4 实现工作条目编辑弹窗 WorkEntryModal
    - 显示该时间段已有条目列表和"添加条目"按钮
    - WorkEntryForm：Category 下拉选择、SubCategory 输入、描述输入
    - 支持逐条添加多条工作条目
    - 保存按钮调用 API 持久化
    - 删除按钮弹出确认对话框
    - 保存失败显示错误提示，保留已填写内容
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 13. 实现 OKR 管理页面
  - [x] 13.1 实现 OKRPage 组件
    - QuarterSelector：季度切换（如 2025 Q1、2025 Q2），默认当前季度
    - ObjectiveCard：卡片式展示 Objective，显示关联 Category 颜色标签
    - KeyResultItem：展示 Key_Result 描述和完成状态
    - 新增/编辑/删除 Objective 和 Key_Result 的表单和交互
    - Objective 创建时 Category 下拉过滤掉"其他"分类
    - 日杂风格卡片布局
    - _需求：11.1, 11.2, 11.3, 11.4, 11.7, 11.8_

- [x] 14. 实现灵感与待办页面
  - [x] 14.1 实现 InspirationPage 组件
    - InspirationForm：快速新增灵感/待办，选择类型和灵感分类
    - InspirationList：条目列表，按 createdAt 降序排列
    - InspirationItem：展示条目内容、类型标签，待办支持完成状态切换（删除线/淡化）
    - CategoryFilter：按灵感分类筛选
    - 灵感分类管理：新增、编辑、删除灵感分类
    - 默认灵感分类：工作、学习、项目、个人、其他
    - _需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.8_

- [x] 15. 实现分类管理页面
  - [x] 15.1 实现 CategoryManagement 组件
    - 展示所有分类及使用次数（Work_Entry + Objective）
    - 新增分类表单
    - 编辑分类名称
    - 删除分类：有关联记录时提示迁移选择
    - "其他"分类禁止删除，UI 隐藏删除按钮
    - 颜色标签展示
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

- [x] 16. 检查点 - 确保前端页面基本功能正常
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 17. 实现定时提醒功能
  - [x] 17.1 创建提醒工具函数 `calendar/client/src/utils/reminderUtils.ts`
    - shouldTriggerReminder：判断当前时间是否为提醒触发时间点（工作日 10:00-18:00 整点及 18:30）
    - getTimeSlotForReminder：计算提醒对应的时间段
    - 延迟提醒状态管理（15 分钟后恢复）
    - 跳过提醒状态管理（永久跳过）
    - _需求：4.1, 4.2, 4.4, 4.5_

  - [ ]* 17.2 编写提醒工具函数属性测试
    - **属性 11：提醒触发时间判定**
    - **属性 12：提醒对应时间段计算**
    - **属性 13：延迟提醒状态机**
    - **属性 14：跳过提醒永久性**
    - **属性 15：已填写时间段跳过提醒**
    - **验证需求：4.1, 4.2, 4.4, 4.5, 4.6**

  - [x] 17.3 实现 ReminderService 和提醒弹窗组件
    - ReminderService：setInterval 每分钟检查，触发提醒
    - 请求浏览器 Notification API 权限（首次登录时）
    - 提醒弹窗：显示提示文字和对应时间段，提供"立即填写"、"稍后提醒"、"跳过"按钮
    - 已填写时间段自动跳过
    - 浏览器不支持或权限被拒绝时降级为页面内弹窗
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 18. 实现 AI 总结前端功能
  - [x] 18.1 实现 AISummaryPanel 组件
    - 总结类型选择：日总结、周总结、月总结、季度总结
    - 目标日期/周/月/季度选择器
    - 调用 API 生成总结，显示加载状态
    - 展示总结内容（含 OKR 推进分析章节）
    - 复制总结文本到剪贴板按钮
    - 历史总结列表查看
    - API 失败显示"AI 总结生成失败，请稍后重试"
    - _需求：6.1, 6.9, 6.10, 6.11, 6.12, 6.14_

- [x] 19. 最终检查点 - 确保所有功能集成完毕
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号，确保需求可追溯
- 检查点任务用于阶段性验证，确保增量开发的稳定性
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 所有上下文文档（需求、设计）在实现时可直接参考
