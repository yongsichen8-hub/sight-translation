# 实现计划：Expression 高亮同步

## 概述

基于已有的 Expression 数据，在 PracticeView 练习模式中对中英文原文进行子字符串匹配高亮渲染。核心实现分为三层：工具函数（匹配与分割）、React 组件（HighlightedText）、PracticeView 集成（Hook + 组件接入）。纯前端实现，后端无需改动。

## 任务

- [x] 1. 实现高亮工具函数
  - [x] 1.1 创建 `src/components/PracticeView/highlightUtils.ts`，实现 `HighlightRange` 和 `TextSegment` 类型定义，以及 `findHighlightRanges`、`mergeRanges`、`splitTextByRanges` 三个函数
    - `findHighlightRanges(text, keywords)`：使用 `String.indexOf` 在文本中查找所有关键词的匹配区间，过滤空字符串关键词，大小写敏感匹配
    - `mergeRanges(ranges)`：将重叠或相邻区间合并为不重叠的有序区间列表
    - `splitTextByRanges(text, ranges)`：按合并后的区间将文本拆分为 `TextSegment[]`，每个片段标记 `highlighted` 布尔值
    - _需求：1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.2 编写属性测试：子字符串匹配完整性（Property 1）
    - **属性 1：子字符串匹配完整性**
    - 在 `src/components/PracticeView/highlightUtils.test.ts` 中使用 `fast-check` 验证：`findHighlightRanges` 返回的每个区间对应原文中的某个关键词，且所有出现位置都被覆盖
    - **验证需求：1.2, 2.1, 2.2, 2.3**

  - [ ]* 1.3 编写属性测试：区间合并正确性（Property 2）
    - **属性 2：区间合并正确性**
    - 验证 `mergeRanges` 输出按 start 升序、不重叠不相邻、覆盖集合与输入一致
    - **验证需求：1.4**

  - [ ]* 1.4 编写属性测试：文本分割完整性（Property 3）
    - **属性 3：文本分割完整性（Round-trip）**
    - 验证 `splitTextByRanges` 产生的所有片段按顺序拼接后等于原始文本
    - **验证需求：2.1, 2.2**

  - [ ]* 1.5 编写属性测试：高亮片段与关键词一致性（Property 4）
    - **属性 4：高亮片段与关键词一致性**
    - 验证完整流程（find → merge → split）后，`highlighted: true` 的片段中每个字符都属于某个关键词匹配，`highlighted: false` 的片段中不包含任何关键词完整匹配
    - **验证需求：1.1, 1.2, 3.2**

  - [ ]* 1.6 编写属性测试：空关键词列表不产生高亮（Property 5）
    - **属性 5：空关键词列表不产生高亮**
    - 验证关键词列表为空时返回空区间数组，splitTextByRanges 产生单个未高亮片段
    - **验证需求：2.4, 3.2**

  - [ ]* 1.7 编写单元测试：highlightUtils 边界情况
    - 在同一测试文件中添加单元测试，覆盖：空文本、单关键词单次/多次匹配、无匹配跳过、空字符串关键词过滤、完全重叠区间、相邻区间、首尾高亮
    - _需求：2.3, 2.4_

- [x] 2. 实现 HighlightedText 组件和 useProjectExpressions Hook
  - [x] 2.1 创建 `src/components/PracticeView/HighlightedText.tsx` 组件
    - 接收 `text: string` 和 `keywords: string[]` 属性
    - 调用 `findHighlightRanges` → `mergeRanges` → `splitTextByRanges` 完整流程
    - 用 `<mark>` 标签渲染高亮片段，应用浅黄色背景（`#FFF9C4`）
    - 关键词列表为空时直接渲染原文
    - _需求：1.1, 1.2, 1.4, 2.1, 2.2_

  - [x] 2.2 创建 `src/components/PracticeView/useProjectExpressions.ts` Hook
    - 接收 `projectId: string | undefined` 参数
    - 通过 `dataService.getExpressions()` 加载表达列表，按 `projectId` 过滤
    - 使用 `useMemo` 提取 `chineseKeywords` 和 `englishKeywords`（过滤空字符串）
    - 提供 `refresh()` 方法供保存/删除后调用
    - 进入练习模式时自动加载，加载失败静默降级
    - _需求：1.3, 3.1, 3.3, 4.1, 4.2_

  - [ ]* 2.3 编写 HighlightedText 组件单元测试
    - 在 `src/components/PracticeView/HighlightedText.test.tsx` 中测试：正确渲染高亮 mark 标签、无关键词时渲染纯文本、空文本处理
    - _需求：1.1, 2.4_

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 集成到 PracticeView
  - [x] 4.1 修改 `src/components/PracticeView/PracticeView.tsx`，集成高亮功能
    - 引入 `useProjectExpressions` Hook，传入 `currentProject?.id`
    - 练习模式下将中文栏和英文栏的纯文本渲染替换为 `HighlightedText` 组件，分别传入 `chineseKeywords` 和 `englishKeywords`
    - 编辑模式下保持 textarea 不变（编辑模式不显示高亮）
    - _需求：1.1, 1.2, 1.3, 5.1, 5.2_

  - [x] 4.2 修改 `handleSaveExpression` 回调，保存成功后调用 `refresh()` 刷新表达列表以更新高亮
    - _需求：1.1, 3.1_

  - [x] 4.3 添加高亮样式到 `src/components/PracticeView/PracticeView.css`
    - 为 `mark` 标签添加 `background-color: #FFF9C4`、`padding: 0`、`border-radius: 2px` 样式
    - _需求：1.1_

  - [ ]* 4.4 编写 PracticeView 集成测试
    - 在 `src/components/PracticeView/PracticeView.test.tsx` 中测试：保存 Expression 后高亮出现、删除后高亮消失、编辑模式切换到练习模式后高亮重新渲染
    - _需求：1.1, 3.2, 5.1, 5.2_

- [x] 5. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了对应的需求编号以确保可追溯性
- 后端无需任何改动，高亮完全基于已有的 Expression 数据和同步链路
- 属性测试使用 `fast-check` 库验证设计文档中的正确性属性
