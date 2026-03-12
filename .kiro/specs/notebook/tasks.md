# 实施计划：Notebook（译前准备笔记本）

## 概述

按照类型定义 → 后端服务 → 后端路由 → 前端 API → 前端状态管理 → 前端组件的顺序逐步实现。富文本编辑器使用 Tiptap，AI 整理通过用户自配置的 OpenAI 兼容 API 实现，Excel 导出使用 xlsx 库在前端生成。

## Tasks

- [x] 1. 定义数据类型和扩展存储默认值
  - [x] 1.1 在 `server/src/types/index.ts` 中添加 Notebook 相关类型定义
    - 添加 `NotebookProject`、`NotebookProjectInput`、`MemoContent`、`TiptapNode`、`OrganizedResult`、`BilingualExpression`、`AiSettings`、`NotebooksFile` 接口
    - _Requirements: 1.1, 1.2, 2.1, 3.4, 4.3, 5.2_
  - [x] 1.2 在 `server/src/services/FileStorageService.ts` 的 `getDefaultValue` 中添加 `notebooks.json` 和 `notebook-ai-settings.json` 的默认值
    - `notebooks.json` → `{ version: 1, notebooks: [] }`
    - `notebook-ai-settings.json` → `{ apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' }`
    - _Requirements: 5.1, 5.2_

- [x] 2. 实现后端 NotebookService
  - [x] 2.1 创建 `server/src/services/NotebookService.ts`，实现项目 CRUD 方法
    - `getNotebooks(userId)` — 读取 notebooks.json 返回项目列表
    - `getNotebook(userId, id)` — 按 ID 查找单个项目
    - `createNotebook(userId, input)` — 验证标题非空，生成 UUID 和时间戳，写入 notebooks.json
    - `updateNotebook(userId, id, updates)` — 更新项目字段，项目不存在抛 NOT_FOUND
    - `deleteNotebook(userId, id)` — 删除项目及关联的 memo 和 organized 文件
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 5.1, 5.2, 5.5_
  - [x] 2.2 在 NotebookService 中实现备忘录读写方法
    - `getMemo(userId, notebookId)` — 读取 `notebook-{id}-memo.json`，不存在返回空文档
    - `saveMemo(userId, notebookId, content)` — 验证内容大小（≤5MB），写入文件
    - _Requirements: 2.7, 2.8, 5.3_
  - [x] 2.3 在 NotebookService 中实现 AI 设置读写方法
    - `getAiSettings(userId)` — 读取 `notebook-ai-settings.json`
    - `saveAiSettings(userId, settings)` — 验证字段非空后写入
    - _Requirements: 3.2_
  - [x] 2.4 在 NotebookService 中实现 AI 一键整理方法
    - `organizeNotes(userId, notebookId)` — 读取用户 AI 配置和备忘录内容，提取纯文本+URL，调用 OpenAI 兼容 API 发送整理 prompt，将结果存入 `notebook-{id}-organized.json`
    - 未配置 AI 设置时抛出 AI_NOT_CONFIGURED 错误
    - 备忘录为空时返回提示
    - 设置 60 秒超时
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 2.5 在 NotebookService 中实现双语表达识别方法
    - `extractBilingualExpressions(userId, notebookId)` — 读取备忘录内容，调用 AI 识别中英双语表达对，返回 BilingualExpression 数组
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  - [ ]* 2.6 编写 NotebookService CRUD 单元测试
    - 测试文件：`server/src/services/__tests__/NotebookService.test.ts`
    - 覆盖：创建（有效输入/空标题）、更新（有效/不存在）、删除（级联删除/不存在）、列表查询
    - _Requirements: 1.2, 1.3, 1.6, 1.7_
  - [ ]* 2.7 编写属性测试：项目持久化往返
    - **Property 1: 项目持久化往返**
    - 生成随机 NotebookProjectInput（非空标题、随机领域和日期），创建后查询验证字段一致
    - **Validates: Requirements 1.2, 1.7**
  - [ ]* 2.8 编写属性测试：空白标题拒绝
    - **Property 2: 空白标题拒绝**
    - 生成仅含空白字符的随机字符串作为标题，验证创建被拒绝，列表长度不变
    - **Validates: Requirements 1.3**
  - [ ]* 2.9 编写属性测试：级联删除完整性
    - **Property 4: 级联删除完整性**
    - 创建项目并写入 memo 和 organized 文件，删除项目后验证关联文件不存在
    - **Validates: Requirements 1.6**
  - [ ]* 2.10 编写属性测试：AI 设置持久化往返
    - **Property 10: AI 设置持久化往返**
    - 生成随机 AiSettings（非空 apiKey、baseUrl、model），保存后查询验证一致
    - **Validates: Requirements 3.2**

- [x] 3. 实现后端路由
  - [x] 3.1 创建 `server/src/routes/notebooks.ts`，实现所有 API 端点
    - GET `/api/notebooks` — 获取项目列表
    - POST `/api/notebooks` — 创建项目（标题为空返回 400）
    - PUT `/api/notebooks/:id` — 更新项目
    - DELETE `/api/notebooks/:id` — 删除项目
    - GET `/api/notebooks/:id/memo` — 获取备忘录
    - PUT `/api/notebooks/:id/memo` — 保存备忘录（内容过大返回 413）
    - GET `/api/notebooks/:id/organized` — 获取整理结果
    - POST `/api/notebooks/:id/organize` — 触发 AI 整理
    - POST `/api/notebooks/:id/export-expressions` — AI 识别双语表达
    - GET `/api/notebooks/settings/ai` — 获取 AI 配置
    - PUT `/api/notebooks/settings/ai` — 保存 AI 配置
    - 所有路由使用 `authMiddleware`
    - _Requirements: 1.1–1.7, 2.7, 2.8, 3.1–3.8, 4.1–4.6, 5.4, 5.5_
  - [x] 3.2 在 `server/src/app.ts` 中注册 notebooks 路由
    - 导入 NotebookService 和路由，挂载到 `/api/notebooks`
    - _Requirements: 5.4_

- [x] 4. Checkpoint — 确保后端编译通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 扩展前端 API 客户端和状态管理
  - [x] 5.1 在 `src/services/ApiClient.ts` 中添加 Notebook 相关类型和方法
    - 添加 `NotebookProject`、`NotebookProjectInput`、`MemoContent`、`OrganizedResult`、`BilingualExpression`、`AiSettings` 类型
    - 添加 `getNotebooks`、`createNotebook`、`updateNotebook`、`deleteNotebook`、`getMemo`、`saveMemo`、`organizeNotes`、`exportExpressions`、`getAiSettings`、`saveAiSettings` 方法
    - _Requirements: 1.1–1.7, 2.7, 3.1, 4.2, 5.1_
  - [x] 5.2 在 `src/context/AppContext.tsx` 的 `AppView` 类型中添加 `'notebooks' | 'notebook-workspace'`
    - _Requirements: 1.4, 1.5_
  - [x] 5.3 在 `src/context/useAppActions.ts` 中添加 `goToNotebooks` 导航方法
    - _Requirements: 1.4, 1.5_

- [x] 6. 实现笔记本列表页面
  - [x] 6.1 创建 `src/components/Notebook/NotebookListPage.tsx`
    - 展示所有笔记本项目（标题、领域、创建时间）
    - "新建项目"按钮 → 弹出创建表单（标题、时间周期、领域）
    - 标题为空时显示"标题不能为空"错误提示
    - 点击项目 → 导航到工作区
    - 编辑和删除按钮（删除需确认）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x] 6.2 创建 `src/components/Notebook/NotebookListPage.css`
    - _Requirements: 1.4_

- [x] 7. 实现笔记本工作区页面
  - [x] 7.1 创建 `src/components/Notebook/MemoEditor.tsx` — Tiptap 富文本编辑器
    - 安装 Tiptap 依赖：`@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-link`、`@tiptap/extension-image`、`@tiptap/extension-underline`、`@tiptap/extension-color`、`@tiptap/extension-text-style`
    - 工具栏：标题（H1/H2/H3）、加粗、斜体、下划线、文字颜色
    - 支持 URL 链接和图片（粘贴/上传，Base64 内联）
    - 内容变更触发 2 秒防抖自动保存
    - 保存失败时顶部显示提示，10 秒后重试
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [x] 7.2 创建 `src/components/Notebook/OrganizedView.tsx` — 整理结果展示
    - 渲染 AI 整理后的 Markdown 内容
    - URL 链接可点击
    - _Requirements: 3.4, 3.6_
  - [x] 7.3 创建 `src/components/Notebook/AiSettingsPanel.tsx` — AI 设置面板
    - API Key（掩码显示）、Base URL（默认 `https://api.openai.com/v1`）、模型名称三个输入字段
    - 保存时验证字段非空
    - _Requirements: 3.2_
  - [x] 7.4 创建 `src/components/Notebook/NotebookWorkspace.tsx` — 工作区主页面
    - 三栏布局：左侧 MemoEditor（~40%）、中间操作按钮区、右侧 OrganizedView（~50%）
    - 中间区域包含"一键整理"按钮、"导出双语表达"按钮、AI 设置按钮
    - 一键整理：点击后显示加载动画、禁用按钮，完成后在右侧展示结果，失败显示错误提示
    - 导出双语表达：调用 API 获取识别结果，使用 xlsx 库在前端生成 Excel 文件并触发下载
    - 文件名格式：`{项目标题}_双语表达_{YYYY-MM-DD}.xlsx`
    - 未识别到双语表达时显示提示
    - 未配置 AI 设置时提示用户先配置
    - _Requirements: 3.1, 3.3, 3.4, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 7.5 创建 `src/components/Notebook/NotebookWorkspace.css` 和 `src/components/Notebook/MemoEditor.css`
    - _Requirements: 2.1, 3.4_
  - [ ]* 7.6 编写属性测试：Excel 数据正确性
    - **Property 6: Excel 数据正确性**
    - 生成随机 BilingualExpression 数组，验证生成的 Excel 工作表行数和内容与输入一致
    - **Validates: Requirements 4.3**
  - [ ]* 7.7 编写属性测试：导出文件名格式
    - **Property 7: 导出文件名格式**
    - 生成随机项目标题和日期，验证文件名符合 `{title}_双语表达_{YYYY-MM-DD}.xlsx` 格式
    - **Validates: Requirements 4.4**

- [x] 8. 集成到主应用
  - [x] 8.1 在 `src/App.tsx` 的导航栏中添加"笔记本"按钮，在 `renderView` 中添加 `notebooks` 和 `notebook-workspace` 视图分支
    - _Requirements: 1.4, 1.5, 5.4_
  - [x] 8.2 创建 `src/components/Notebook/index.ts` 导出组件
    - _Requirements: 1.4_

- [x] 9. Checkpoint — 确保前后端编译通过，功能可用
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. 补充属性测试
  - [ ]* 10.1 编写属性测试：URL 提取保留
    - **Property 5: URL 提取保留**
    - 生成包含随机 URL 的 Tiptap JSON 文档，验证提取纯文本时所有 URL 完整保留
    - **Validates: Requirements 3.6**
  - [ ]* 10.2 编写属性测试：用户数据隔离
    - **Property 9: 用户数据隔离**
    - 生成两个随机 userId，用户 A 创建的项目不出现在用户 B 的查询结果中
    - **Validates: Requirements 5.5**
  - [ ]* 10.3 编写属性测试：项目列表完整展示
    - **Property 3: 项目列表完整展示**
    - 生成随机项目列表，验证每个项目都包含 title、domain、createdAt 且非空
    - **Validates: Requirements 1.4**

- [x] 11. Final checkpoint — 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 所有 UI 文本使用中文
- 富文本编辑器使用 Tiptap，图片以 Base64 内联存储
- AI 服务由用户自行配置 API Key、Base URL 和模型，兼容任何 OpenAI 兼容 API
- Excel 导出在前端使用 xlsx 库生成，避免后端处理二进制文件
- Property 8（未认证请求拒绝）由现有 authMiddleware 保证，无需额外实现
