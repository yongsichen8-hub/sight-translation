# 实现计划：飞书工时机器人

## 概述

本实现计划将飞书工时机器人的技术设计转化为可执行的编码任务。采用 TypeScript + Express.js 技术栈，实现与飞书平台的消息监听、互动卡片推送、多维表格数据同步等核心功能。

## 任务列表

- [x] 1. 项目初始化与基础配置
  - [x] 1.1 创建项目目录结构并初始化 npm 项目
    - 创建 `feishu-workhour-bot/` 目录
    - 初始化 `package.json`，配置 TypeScript、Express、@larksuiteoapi/node-sdk、fast-check 等依赖
    - 创建 `tsconfig.json` 配置文件
    - 创建 `.env.example` 环境变量模板
    - _需求: 7.2_

  - [x] 1.2 定义核心类型与接口
    - 创建 `src/types/index.ts`，定义 TimeRecord、Translator、Project、FeishuUser 等接口
    - 创建 `src/types/feishu.ts`，定义 MessageEvent、CardAction、InteractiveCard 等飞书相关类型
    - _需求: 4.2, 6.1_

- [x] 2. 实现 Tracker 数据服务
  - [x] 2.1 实现 TrackerService 核心功能
    - 创建 `src/services/TrackerService.ts`
    - 实现 `addTimeRecord()` 方法，写入工时记录到 JSON 文件
    - 实现 `findOrCreateTranslator()` 方法，查找或创建译员记录
    - 实现 `getProjectTotalTime()` 方法，计算项目总工时
    - 实现数据持久化到 `tracker-data.json`
    - _需求: 4.1, 4.2, 4.3, 5.1_

  - [ ]* 2.2 编写 Property 9 属性测试：工时记录数据格式
    - **Property 9: 工时记录数据格式**
    - 验证写入的记录包含完整字段且格式正确
    - **验证: 需求 4.2**

  - [ ]* 2.3 编写 Property 10 属性测试：译员自动创建
    - **Property 10: 译员自动创建**
    - 验证新用户首次提交时自动创建译员记录
    - **验证: 需求 4.3, 6.3, 6.5**

  - [ ]* 2.4 编写 Property 12 属性测试：工时汇总计算正确性
    - **Property 12: 工时汇总计算正确性**
    - 验证项目总工时等于所有译员口译+笔译工时之和
    - **验证: 需求 5.1, 5.2, 5.5**

- [x] 3. 实现表单验证模块
  - [x] 3.1 实现 FormValidator 验证逻辑
    - 创建 `src/validators/FormValidator.ts`
    - 实现正整数验证函数
    - 实现项目-工时配对验证函数
    - 实现至少填写一项验证函数
    - _需求: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 编写 Property 6 属性测试：表单至少填写一项验证
    - **Property 6: 表单至少填写一项验证**
    - 验证空表单被拒绝，至少填写一项时接受
    - **验证: 需求 3.2**

  - [ ]* 3.3 编写 Property 7 属性测试：工时正整数验证
    - **Property 7: 工时正整数验证**
    - 验证非正整数输入被拒绝
    - **验证: 需求 3.3**

  - [ ]* 3.4 编写 Property 8 属性测试：项目-工时配对验证
    - **Property 8: 项目-工时配对验证**
    - 验证项目和工时必须配对完整
    - **验证: 需求 3.4, 3.5**

- [ ] 4. 检查点 - 确保所有测试通过
  - 运行 `npm test` 确保所有测试通过
  - 如有问题请向用户确认

- [x] 5. 实现卡片构建器
  - [x] 5.1 实现 CardBuilder 卡片构建功能
    - 创建 `src/services/CardBuilder.ts`
    - 实现 `buildWorkhourCard()` 方法，构建工时填报互动卡片
    - 实现 `buildSuccessCard()` 方法，构建成功提示卡片
    - 实现 `buildErrorCard()` 方法，构建错误提示卡片
    - 卡片包含口译/笔译项目单选、工时输入框、提交/取消按钮
    - _需求: 3.1, 3.6_

  - [ ]* 5.2 编写 Property 5 属性测试：卡片结构完整性
    - **Property 5: 卡片结构完整性**
    - 验证生成的卡片包含所有必需元素
    - **验证: 需求 3.1, 3.6**

- [x] 6. 实现多维表格服务
  - [x] 6.1 实现 BitableService 飞书多维表格操作
    - 创建 `src/services/BitableService.ts`
    - 实现 `getOngoingProjects()` 方法，读取进行中项目
    - 实现 `updateWorkhourStats()` 方法，更新工时统计字段
    - 实现 `findOrCreateWorkhourRecord()` 方法，查找或创建工时统计行
    - 集成 @larksuiteoapi/node-sdk 调用飞书 API
    - _需求: 2.1, 5.2, 5.3_

  - [ ]* 6.2 编写 Property 4 属性测试：项目状态过滤
    - **Property 4: 项目状态过滤**
    - 验证只返回状态为"进行中"的项目
    - **验证: 需求 2.1, 2.2**

  - [ ]* 6.3 编写 Property 13 属性测试：工时统计行自动创建
    - **Property 13: 工时统计行自动创建**
    - 验证不存在的项目行会被自动创建
    - **验证: 需求 5.3**

- [x] 7. 实现用户服务
  - [x] 7.1 实现 UserService 用户身份识别
    - 创建 `src/services/UserService.ts`
    - 实现 `getUserInfo()` 方法，调用飞书 API 获取用户信息
    - 处理 API 调用失败时使用 open_id 作为备用姓名
    - _需求: 6.1, 6.4, 6.5_

  - [ ]* 7.2 编写 Property 14 属性测试：用户身份提取
    - **Property 14: 用户身份提取**
    - 验证正确提取 open_id 并用于查找/创建译员
    - **验证: 需求 6.1, 6.2**

- [ ] 8. 检查点 - 确保所有测试通过
  - 运行 `npm test` 确保所有测试通过
  - 如有问题请向用户确认

- [x] 9. 实现事件处理器
  - [x] 9.1 实现 EventHandler 事件处理核心逻辑
    - 创建 `src/handlers/EventHandler.ts`
    - 实现 `handleChallenge()` 方法，处理 URL 验证
    - 实现 `handleMessageEvent()` 方法，处理消息事件
    - 实现 `handleCardAction()` 方法，处理卡片回调
    - 实现事件去重逻辑（基于 event_id）
    - 实现签名验证逻辑
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 7.3_

  - [ ]* 9.2 编写 Property 1 属性测试：关键词触发卡片推送
    - **Property 1: 关键词触发卡片推送**
    - 验证包含"工时"的消息触发卡片，不包含则返回提示
    - **验证: 需求 1.1, 1.2**

  - [ ]* 9.3 编写 Property 2 属性测试：事件去重幂等性
    - **Property 2: 事件去重幂等性**
    - 验证重复 event_id 被忽略
    - **验证: 需求 1.4**

  - [ ]* 9.4 编写 Property 3 属性测试：签名验证安全性
    - **Property 3: 签名验证安全性**
    - 验证签名不匹配时返回 403
    - **验证: 需求 1.5**

  - [ ]* 9.5 编写 Property 15 属性测试：Challenge 验证响应
    - **Property 15: Challenge 验证响应**
    - 验证 Challenge 请求返回相同的 challenge 值
    - **验证: 需求 7.3**

- [x] 10. 实现 Webhook 服务器
  - [x] 10.1 实现 WebhookServer 主入口
    - 创建 `src/server.ts`
    - 配置 Express 应用，设置 JSON 解析中间件
    - 实现 `POST /webhook/event` 路由，处理飞书事件订阅
    - 实现 `POST /webhook/card` 路由，处理卡片交互回调
    - 实现 `GET /health` 路由，健康检查
    - 从环境变量读取配置
    - _需求: 7.1, 7.2, 7.4_

  - [x] 10.2 实现配置管理模块
    - 创建 `src/config/index.ts`
    - 从环境变量加载飞书应用凭证、多维表格 ID 等配置
    - 实现配置验证，确保必需配置项存在
    - _需求: 7.2_

- [x] 11. 实现写入失败阻断逻辑
  - [x] 11.1 实现错误处理与阻断机制
    - 在 EventHandler 中实现 Tracker 写入失败时阻断多维表格回写
    - 实现错误日志记录
    - 实现用户错误提示消息发送
    - _需求: 4.4, 5.4_

  - [ ]* 11.2 编写 Property 11 属性测试：写入失败阻断回写
    - **Property 11: 写入失败阻断回写**
    - 验证 Tracker 写入失败时不执行多维表格回写
    - **验证: 需求 4.4**

- [x] 12. 集成与端到端测试
  - [x] 12.1 组件集成与连接
    - 在 `src/index.ts` 中组装所有服务组件
    - 实现依赖注入，连接 EventHandler、BitableService、TrackerService、CardBuilder、UserService
    - 确保完整的消息处理流程可运行
    - _需求: 1.1, 2.1, 4.1, 5.1_

  - [ ]* 12.2 编写集成测试
    - 创建 `tests/integration/e2e.test.ts`
    - 测试完整的消息接收 → 卡片推送 → 表单提交 → 数据写入流程
    - 使用 mock 模拟飞书 API 调用
    - _需求: 1.1, 2.1, 4.1, 5.1_

- [x] 13. 最终检查点 - 确保所有测试通过
  - 运行 `npm test` 确保所有单元测试和属性测试通过
  - 运行 `npm run test:coverage` 检查测试覆盖率
  - 如有问题请向用户确认

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 开发
- 每个任务都引用了对应的需求编号，确保可追溯性
- 检查点任务用于增量验证，确保每个阶段的代码质量
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
