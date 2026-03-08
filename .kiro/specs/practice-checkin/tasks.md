# 实施计划：练习打卡功能

## 概述

按照数据模型 → 后端 API → 前端服务层 → UI 组件的顺序，逐步实现打卡功能。每一步都在前一步基础上构建，确保代码始终可集成运行。

## Tasks

- [x] 1. 扩展 Project 数据模型，添加打卡字段
  - [x] 1.1 在 `server/src/types/index.ts` 的 `Project` 接口中添加 `checkedIn?: boolean` 和 `checkedInAt?: string` 字段
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 在 `src/types/models.ts` 的 `Project` 接口中添加 `checkedIn?: boolean` 和 `checkedInAt?: Date` 字段
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.3 在 `src/services/ApiClient.ts` 的 `Project` 接口中添加 `checkedIn?: boolean` 和 `checkedInAt?: string` 字段
    - _Requirements: 1.1, 1.2_

- [x] 2. 实现后端打卡服务和 API 端点
  - [x] 2.1 在 `server/src/services/DataService.ts` 中添加 `checkInProject(userId, projectId)` 方法
    - 读取项目数据，找到对应项目
    - 项目不存在时抛出 `NOT_FOUND` 错误
    - 已打卡项目直接返回（幂等性）
    - 未打卡项目设置 `checkedIn=true`、`checkedInAt=当前时间`、更新 `updatedAt`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 在 `server/src/routes/projects.ts` 中添加 `POST /api/projects/:id/checkin` 路由
    - 调用 `dataService.checkInProject`
    - 成功返回 `{ success: true, data: { message: '打卡成功' } }`
    - 项目不存在返回 404 `{ success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } }`
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 2.3 编写 `server/src/services/DataService.ts` 的 `checkInProject` 单元测试
    - 测试正常打卡、幂等性、404 错误三种场景
    - 测试文件：`server/src/services/__tests__/DataService.checkin.test.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 2.4 编写属性测试：打卡接口幂等性
    - **Property 6: 打卡接口幂等性**
    - 生成随机项目，调用 checkInProject 1~10 次，验证最终结果与调用 1 次相同，`checkedInAt` 保持首次打卡时间不变
    - **Validates: Requirements 5.4**
  - [ ]* 2.5 编写属性测试：打卡接口正确设置字段
    - **Property 5: 打卡接口正确设置字段**
    - 生成随机未打卡项目，调用 checkInProject 后验证 `checkedIn` 为 `true`，`checkedInAt` 为有效 ISO 时间字符串，`updatedAt` 已更新
    - **Validates: Requirements 5.2**

- [x] 3. Checkpoint - 确保后端测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 实现前端服务层打卡方法
  - [x] 4.1 在 `src/services/ApiClient.ts` 中添加 `checkInProject(id)` 方法
    - 发送 `POST /api/projects/${id}/checkin` 请求
    - _Requirements: 5.1_
  - [x] 4.2 在 `src/services/DataService.ts` 中添加 `checkInProject(id)` 方法
    - 已认证模式：调用 `apiClient.checkInProject(id)`
    - 本地模式：更新 IndexedDB 中的 `checkedIn`、`checkedInAt`、`updatedAt` 字段
    - 将方法添加到 `dataService` 导出对象中
    - _Requirements: 5.1, 5.2_
  - [x] 4.3 在 `src/services/DataService.ts` 的 `getProjects` 和 `getProject` 中确保 `checkedIn` 和 `checkedInAt` 字段正确映射
    - API 返回的 `checkedInAt` 字符串需转换为 `Date` 对象
    - _Requirements: 1.1, 1.2_

- [x] 5. 实现 PracticeView 打卡按钮和计时器控制
  - [x] 5.1 修改 `src/components/PracticeView/PracticeView.tsx`，添加打卡状态管理
    - 新增 `isCheckedIn` 状态，初始化时从项目数据读取 `checkedIn` 字段
    - 已打卡项目不启动计时器（在计时器 `useEffect` 中检查 `isCheckedIn`）
    - 已打卡项目不执行每 30 秒自动保存
    - _Requirements: 2.6, 3.1, 3.2_
  - [x] 5.2 在 PracticeView 练习模式内容区域底部添加打卡按钮和已完成状态
    - 未打卡：显示"打卡"按钮（中文文本）
    - 已打卡：显示"✅ 已打卡完成"状态标识
    - 打卡流程：点击 → 调用 `dataService.checkInProject` → 停止计时器 → 保存最终时间 → 显示成功 Toast
    - 打卡失败：显示错误 Toast，保留按钮供重试
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 5.3 添加打卡按钮和已完成状态的 CSS 样式到 `src/components/PracticeView/PracticeView.css`
    - _Requirements: 2.1, 2.6_
  - [ ]* 5.4 编写属性测试：向后兼容 — 未设置 checkedIn 视为 false
    - **Property 1: 向后兼容 — 未设置 checkedIn 视为 false**
    - 生成随机 Project 对象，`checkedIn` 为 `undefined`/`null`/`false`，验证 `project.checkedIn ?? false` 始终为 `false`
    - **Validates: Requirements 1.3**

- [x] 6. 实现 ProjectList 打卡状态展示
  - [x] 6.1 添加 `formatTime` 工具函数，将秒数格式化为 `HH:MM:SS`
    - 可放在 `src/components/ProjectManager/ProjectList/ProjectList.tsx` 内或单独工具文件
    - _Requirements: 4.2_
  - [x] 6.2 修改 `src/components/ProjectManager/ProjectList/ProjectList.tsx`，在已打卡项目卡片上显示"✅ 打卡完成"徽章和总用时
    - 未打卡项目不显示徽章和用时
    - 用时格式：`HH:MM:SS`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 6.3 添加打卡徽章和用时的 CSS 样式
    - _Requirements: 4.1, 4.2_
  - [ ]* 6.4 编写属性测试：时间格式化正确性
    - **Property 4: 时间格式化正确性**
    - 生成 0 到 360000 的随机非负整数，验证 `formatTime(n)` 输出满足 `HH:MM:SS` 格式，且 `HH = floor(n/3600)`、`MM = floor((n%3600)/60)`、`SS = n%60`，各部分零补齐两位
    - **Validates: Requirements 4.2**

- [x] 7. Final checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 所有 UI 文本使用中文
- 使用可选字段（`?`）确保与已有项目数据的向后兼容，无需数据迁移
- Property 2（打卡后计时器停止）和 Property 3（已打卡项目不启动计时器）涉及 React 组件生命周期，更适合通过单元测试验证，已包含在任务 5 的实现逻辑中
