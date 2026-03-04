# Implementation Plan: Sight Translation Trainer

## Overview

基于 React 18 + TypeScript + Vite 构建视译练习软件，采用 IndexedDB (Dexie.js) 进行本地数据持久化，使用 pdf.js 和 mammoth.js 处理文件解析。实现按照数据层 → 服务层 → UI层的顺序进行。

## Tasks

- [x] 1. 项目初始化和基础设施搭建
  - [x] 1.1 初始化 Vite + React + TypeScript 项目
    - 创建项目结构
    - 配置 TypeScript 严格模式
    - 安装依赖: dexie, pdf.js, mammoth, uuid
    - _Requirements: 技术选型_
  - [x] 1.2 配置测试框架
    - 安装 vitest, @testing-library/react, fast-check
    - 配置 vitest.config.ts
    - 创建测试 setup 文件
    - _Requirements: Testing Strategy_
  - [x] 1.3 创建数据模型和类型定义
    - 定义 Project, Expression, Flashcard, ReviewRecord 接口
    - 定义错误类型: FileParseError, ValidationError, DuplicateError, DatabaseError
    - _Requirements: 1.1-1.9, 4.1-4.6, 6.1-6.9_

- [x] 2. 数据层实现 - IndexedDB 配置
  - [x] 2.1 实现 Dexie 数据库配置
    - 创建 SightTranslationDB 类
    - 定义表结构和索引
    - 实现数据库初始化逻辑
    - _Requirements: 7.1-7.4_
  - [ ]* 2.2 编写数据库持久化属性测试
    - **Property 22: Project Persistence Round-Trip**
    - **Property 23: Expression Persistence Round-Trip**
    - **Property 24: Flashcard Persistence Round-Trip**
    - **Validates: Requirements 7.1-7.4**

- [x] 3. Checkpoint - 数据层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 服务层实现 - FileParser
  - [x] 4.1 实现 FileParser 服务
    - 实现 isSupportedFormat 方法检查文件格式
    - 实现 TXT 文件解析
    - 集成 pdf.js 实现 PDF 解析
    - 集成 mammoth.js 实现 Word 解析
    - 实现空内容检测
    - _Requirements: 1.3, 1.4, 1.5, 1.6_
  - [ ]* 4.2 编写 FileParser 属性测试
    - **Property 3: Supported File Format Acceptance**
    - **Property 4: File Parsing Preserves Content**
    - **Property 5: Empty File Rejection**
    - **Validates: Requirements 1.3, 1.4, 1.5**

- [x] 5. 服务层实现 - SentenceSplitter
  - [x] 5.1 实现 SentenceSplitter 服务
    - 实现中文句子切分 (。！？；)
    - 实现英文句子切分 (. ! ?)
    - 保持句子原始顺序
    - 处理无标点文本的边界情况
    - _Requirements: 2.1-2.5_
  - [ ]* 5.2 编写 SentenceSplitter 属性测试
    - **Property 8: Sentence Splitting Round-Trip**
    - **Property 9: Punctuation-Based Splitting**
    - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 6. 服务层实现 - ProjectManager
  - [x] 6.1 实现 ProjectManager 服务
    - 实现 createProject 方法（含文件解析和句子切分）
    - 实现项目名唯一性验证
    - 实现 getProjects 和 getProject 方法
    - 实现 deleteProject 方法（含级联删除表达）
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9_
  - [ ]* 6.2 编写 ProjectManager 属性测试
    - **Property 1: Project Name Uniqueness**
    - **Property 2: Project Requires Both Files**
    - **Property 6: Project List Integrity**
    - **Property 7: Project Deletion Cascades to Expressions**
    - **Validates: Requirements 1.1, 1.2, 1.7, 1.8, 1.9**

- [x] 7. Checkpoint - 项目管理功能验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 服务层实现 - ExpressionCollector
  - [x] 8.1 实现 ExpressionCollector 服务
    - 实现 saveExpression 方法（含重复检测）
    - 实现 getExpressions 方法（支持语言过滤和关键词搜索）
    - 实现 updateNotes 方法
    - 实现 deleteExpression 方法
    - 实现 isDuplicate 方法
    - _Requirements: 4.1-4.6, 5.1-5.6_
  - [ ]* 8.2 编写 ExpressionCollector 属性测试
    - **Property 11: Expression Data Completeness**
    - **Property 12: Expression Duplicate Prevention**
    - **Property 13: Notes Update Persistence**
    - **Property 14: Language Filter Correctness**
    - **Property 15: Keyword Search Correctness**
    - **Validates: Requirements 4.3-4.6, 5.2-5.4**

- [x] 9. 服务层实现 - FlashcardGenerator
  - [x] 9.1 实现 FlashcardGenerator 服务
    - 实现 scheduleExpression 方法（新表达创建复习计划）
    - 实现 getDueCards 和 getDueCount 方法
    - 实现 recordReview 方法（remembered/forgot 逻辑）
    - 实现 removeSchedule 方法
    - 实现艾宾浩斯间隔计算 [1, 2, 4, 7, 15, 30]
    - _Requirements: 6.1-6.9_
  - [ ]* 9.2 编写 FlashcardGenerator 属性测试
    - **Property 16: Expression Deletion Cascades to Flashcard**
    - **Property 17: Flashcard Generation on Expression Save**
    - **Property 18: Review Interval Calculation**
    - **Property 19: Remembered Advances Interval**
    - **Property 20: Forgot Resets Interval**
    - **Property 21: Due Count Accuracy**
    - **Validates: Requirements 5.5, 5.6, 6.1-6.8**

- [x] 10. Checkpoint - 服务层完整性验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. UI层实现 - 状态管理和路由
  - [x] 11.1 实现应用状态管理
    - 创建 AppContext 和 useReducer
    - 定义 AppState 和 actions
    - 实现视图切换逻辑
    - _Requirements: 3.1-3.6_
  - [x] 11.2 创建基础 UI 组件
    - 创建 Toast 组件用于错误提示
    - 创建 Loading 组件
    - 创建 Button, Modal 等通用组件
    - _Requirements: 1.6, 7.5_

- [x] 12. UI层实现 - ProjectManager 视图
  - [x] 12.1 实现项目列表视图
    - 显示所有项目列表
    - 实现项目删除功能
    - _Requirements: 1.7, 1.8_
  - [x] 12.2 实现项目创建表单
    - 实现文件上传组件（支持 TXT/PDF/Word）
    - 实现项目名称输入
    - 显示上传错误信息
    - _Requirements: 1.1-1.6_

- [x] 13. UI层实现 - PracticeView 视图
  - [x] 13.1 实现练习模式选择
    - 实现中译英/英译中模式切换
    - _Requirements: 3.1_
  - [x] 13.2 实现句子显示和翻译切换
    - 逐句显示源语言文本
    - 实现"显示翻译"按钮
    - 实现翻译显示/隐藏切换
    - 保持句子对齐
    - _Requirements: 3.2-3.6_
  - [ ]* 13.3 编写句子对齐属性测试
    - **Property 10: Sentence Pair Alignment**
    - **Validates: Requirements 3.6**
  - [x] 13.4 实现表达选择和收藏
    - 实现文本选择高亮
    - 显示"保存表达"选项
    - 实现表达保存（含上下文）
    - _Requirements: 4.1-4.4_

- [x] 14. Checkpoint - 核心练习功能验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. UI层实现 - GlossaryManager 视图
  - [x] 15.1 实现术语库列表视图
    - 显示所有收藏的表达
    - 实现语言过滤功能
    - 实现关键词搜索功能
    - _Requirements: 5.1-5.3_
  - [x] 15.2 实现表达编辑和删除
    - 实现备注编辑功能
    - 实现表达删除功能
    - _Requirements: 5.4, 5.5_

- [x] 16. UI层实现 - FlashcardReview 视图
  - [x] 16.1 实现 Flashcard 复习界面
    - 显示今日待复习数量
    - 显示源语言表达
    - 实现"显示翻译"功能
    - 实现"记住/忘记"按钮
    - 显示无待复习提示
    - _Requirements: 6.1-6.9_

- [x] 17. 集成和错误处理
  - [x] 17.1 实现统一错误处理
    - 集成 Toast 错误提示
    - 实现数据加载失败处理
    - 实现"使用空数据开始"选项
    - _Requirements: 1.6, 7.5_
  - [x] 17.2 实现级联删除集成
    - 项目删除时清理表达
    - 表达删除时清理 Flashcard
    - _Requirements: 1.9, 5.6_

- [x] 18. Final Checkpoint - 完整功能验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document
- 使用 Vitest + fast-check 进行属性测试，每个属性至少运行 100 次迭代
