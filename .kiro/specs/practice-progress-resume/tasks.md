# 实现计划：练习进度记忆

## 概述

基于现有的 PracticeView 组件和 DataService 数据层，增加滚动进度的自动保存与恢复功能。实现路径为：先扩展数据模型，再添加工具函数，然后修改 PracticeView 组件的退出和初始化逻辑，最后通过 DataService 持久化进度数据。

## 任务

- [x] 1. 扩展数据模型，新增 ProgressData 类型和 Project.practiceProgress 字段
  - [x] 1.1 在 `src/types/models.ts` 中新增 `ProgressData` 接口（含 `scrollPercentage: number` 和 `updatedAt: Date` 字段），并在 `Project` 接口中新增可选字段 `practiceProgress?: ProgressData`
    - _需求：3.4_
  - [x] 1.2 在 `server/src/types/index.ts` 的 `Project` 接口中新增可选字段 `practiceProgress?: { scrollPercentage: number; updatedAt: string }`
    - _需求：3.5_
  - [x] 1.3 在 `src/services/ApiClient.ts` 的 `Project` 接口中同步新增 `practiceProgress?: { scrollPercentage: number; updatedAt: string }` 字段
    - _需求：3.1_

- [x] 2. 实现滚动百分比计算与恢复工具函数
  - [x] 2.1 在 `src/components/PracticeView/` 下新建 `scrollUtils.ts`，实现 `calculateScrollPercentage(element: HTMLElement): number` 函数，根据 `scrollTop / (scrollHeight - clientHeight)` 计算百分比，内容不可滚动时返回 0，结果钳位到 [0, 1]
    - _需求：1.1, 1.3_
  - [x] 2.2 在 `scrollUtils.ts` 中实现 `restoreScrollPosition(element: HTMLElement, percentage: number): void` 函数，根据百分比计算目标 scrollTop 并设置，超出范围时钳位到内容末尾
    - _需求：2.1, 2.4_
  - [ ]* 2.3 为 `calculateScrollPercentage` 编写属性测试
    - **属性 1：滚动百分比计算的有界性**
    - **验证需求：1.1, 1.3**
  - [ ]* 2.4 为 `calculateScrollPercentage` 和 `restoreScrollPosition` 编写属性测试
    - **属性 2：滚动位置保存-恢复往返一致性**
    - **验证需求：1.1, 1.3, 2.1**
  - [ ]* 2.5 为左右栏恢复逻辑编写属性测试
    - **属性 4：左右栏滚动同步**
    - **验证需求：2.3**
  - [ ]* 2.6 为 `calculateScrollPercentage` 和 `restoreScrollPosition` 编写单元测试
    - 测试内容不可滚动时返回 0
    - 测试百分比超出范围时钳位到末尾
    - 测试正常滚动位置的计算与恢复
    - _需求：1.3, 2.4_

- [x] 3. 在前端 DataService 中新增 updateProjectProgress 方法
  - [x] 3.1 在 `src/services/DataService.ts` 中新增 `updateProjectProgress(id: string, progress: { scrollPercentage: number; updatedAt: string }): Promise<void>` 方法，已登录时调用 `apiClient.updateProject(id, { practiceProgress: progress })`，未登录时更新 IndexedDB 中对应项目的 `practiceProgress` 字段
    - _需求：3.1, 3.2, 3.3_
  - [ ]* 3.2 为 `updateProjectProgress` 编写属性测试
    - **属性 3：进度数据持久化往返一致性**
    - **验证需求：3.1, 3.4**

- [x] 4. 修改 PracticeView 组件，实现退出时保存和进入时恢复
  - [x] 4.1 修改 `src/components/PracticeView/PracticeView.tsx` 的 `handleExit` 函数：在调用 `exitPractice()` 之前，使用 `calculateScrollPercentage` 计算练习模式下内容区（左栏）的滚动百分比，调用 `dataService.updateProjectProgress` 保存进度数据，保存失败时静默处理不阻断退出
    - _需求：1.1, 1.2, 1.4_
  - [x] 4.2 修改 `PracticeView.tsx` 的初始化 `useEffect`：在内容渲染完成后，从 `currentProject.practiceProgress` 读取 `scrollPercentage`，使用 `restoreScrollPosition` 同时恢复左栏和右栏的滚动位置；无 `practiceProgress` 时从顶部开始
    - _需求：2.1, 2.2, 2.3, 2.4_
  - [ ]* 4.3 为 PracticeView 的进度保存和恢复逻辑编写单元测试
    - 测试退出时调用 `updateProjectProgress` 保存进度
    - 测试进入已有进度的项目时恢复滚动位置
    - 测试进入无进度项目时从顶部开始
    - 测试保存失败时退出流程不受影响
    - 测试编辑模式切换到练习模式后退出，保存的是练习模式的位置
    - _需求：1.1, 1.2, 1.4, 2.1, 2.2_

- [x] 5. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 后端无需修改代码，现有的 `PUT /api/projects/:id` 已支持 `Partial<Project>` 更新，新增的 `practiceProgress` 字段会自动持久化
- 每个任务引用了对应的需求编号以确保可追溯性
- 属性测试使用 `fast-check` 库，验证设计文档中定义的正确性属性
