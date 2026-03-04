# Implementation Plan: 飞书登录集成

## Overview

本实现计划将视译练习平台从纯前端应用扩展为前后端分离架构，实现飞书 OAuth 登录、JWT 会话管理、JSON 文件持久化和本地数据迁移功能。

## Tasks

- [x] 1. 后端项目初始化
  - [x] 1.1 创建后端项目结构和配置
    - 创建 `server/` 目录，初始化 package.json
    - 配置 TypeScript（tsconfig.json）
    - 安装依赖：express, jsonwebtoken, uuid, dotenv, express-rate-limit, cookie-parser
    - 创建 `.env.example` 文件定义环境变量模板
    - _Requirements: 4.1, 8.2_

  - [x] 1.2 创建核心类型定义
    - 创建 `server/src/types/` 目录
    - 定义 User, Project, Expression, Flashcard, ReviewRecord 接口
    - 定义 FeishuOAuthConfig, FeishuTokenResponse, FeishuUserInfo 接口
    - 定义 AuthResult, TokenPair, JWTPayload 接口
    - 定义 ErrorResponse 统一错误响应格式
    - _Requirements: 4.9, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. 文件存储服务实现
  - [x] 2.1 实现 FileStorageService 核心功能
    - 实现 `ensureUserDir()` 创建用户目录
    - 实现 `getUserDir()` 获取用户目录路径
    - 实现 `readJson()` 读取 JSON 文件
    - 实现 `writeJson()` 写入 JSON 文件（带备份和锁）
    - 实现路径安全验证，防止目录遍历攻击
    - _Requirements: 5.1, 5.8, 5.9, 8.5_

  - [ ]* 2.2 编写 FileStorageService 属性测试
    - **Property 3: JSON 文件序列化往返**
    - **Property 6: 文件路径安全验证**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 8.5**

  - [ ]* 2.3 编写 FileStorageService 单元测试
    - 测试文件读写操作
    - 测试备份和回滚机制
    - 测试路径安全检查（恶意路径拒绝）
    - _Requirements: 5.8, 5.9, 8.5_

- [x] 3. 认证服务实现
  - [x] 3.1 实现 AuthService 飞书 OAuth 功能
    - 实现 `getAuthorizationUrl()` 生成飞书授权 URL
    - 实现 `handleCallback()` 处理 OAuth 回调
    - 实现 `exchangeToken()` 用授权码交换 access_token
    - 实现 `getUserInfo()` 调用飞书 API 获取用户信息
    - 实现 state 参数生成和验证
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [x] 3.2 实现 AuthService JWT 功能
    - 实现 `generateToken()` 生成 JWT 令牌
    - 实现 `verifyToken()` 验证 JWT 令牌
    - 实现 `refreshToken()` 刷新令牌
    - 配置 JWT 有效期为 7 天
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8_

  - [ ]* 3.3 编写 AuthService 属性测试
    - **Property 1: JWT 生成和验证往返**
    - **Property 4: OAuth state 参数安全**
    - **Validates: Requirements 1.4, 1.7, 2.1, 2.2, 2.3, 2.4, 2.8, 8.7**

  - [ ]* 3.4 编写 AuthService 单元测试
    - 测试 OAuth URL 生成
    - 测试 JWT 生成和验证
    - 测试 state 参数验证
    - 测试错误处理（无效授权码、过期 token）
    - _Requirements: 1.5, 1.6, 2.4, 2.6_

- [x] 4. Checkpoint - 核心服务验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 数据服务实现
  - [x] 5.1 实现 DataService 用户管理
    - 实现 `getUser()` 获取用户信息
    - 实现 `createUser()` 创建新用户
    - 实现 `updateUser()` 更新用户信息
    - 自动设置 created_at 和 updated_at 时间戳
    - _Requirements: 5.2, 5.7_

  - [x] 5.2 实现 DataService 项目管理
    - 实现 `getProjects()` 获取用户项目列表
    - 实现 `getProject()` 获取单个项目
    - 实现 `createProject()` 创建项目
    - 实现 `updateProject()` 更新项目
    - 实现 `deleteProject()` 删除项目
    - _Requirements: 3.2, 3.3, 4.4, 5.3_

  - [x] 5.3 实现 DataService 表达和闪卡管理
    - 实现表达 CRUD 操作（getExpressions, createExpression, updateExpression, deleteExpression）
    - 实现闪卡查询和更新（getFlashcards, getDueFlashcards, updateFlashcard）
    - 实现复习记录管理（createReviewRecord, getReviewRecords）
    - _Requirements: 3.4, 3.5, 4.5, 4.6, 4.7, 5.4, 5.5, 5.6_

  - [ ]* 5.4 编写 DataService 属性测试
    - **Property 2: 用户数据隔离**
    - **Property 5: 时间戳自动设置**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 5.7**

  - [ ]* 5.5 编写 DataService 单元测试
    - 测试 CRUD 操作
    - 测试数据隔离（用户 A 无法访问用户 B 数据）
    - 测试时间戳自动设置
    - _Requirements: 3.6, 5.7_

- [x] 6. API 路由和中间件实现
  - [x] 6.1 实现认证中间件
    - 实现 `authMiddleware` 验证 JWT Cookie
    - 处理 401 未认证响应
    - 处理 403 无权限响应
    - 将用户信息注入 request 对象
    - _Requirements: 2.2, 2.3, 2.4, 4.8_

  - [x] 6.2 实现请求频率限制中间件
    - 使用 express-rate-limit 实现频率限制
    - 配置每 IP 每分钟最多 100 次请求
    - 返回 429 状态码
    - _Requirements: 8.4_

  - [x] 6.3 实现认证路由
    - GET /api/auth/feishu/login - 获取飞书授权 URL
    - GET /api/auth/feishu/callback - 处理 OAuth 回调
    - GET /api/auth/me - 获取当前用户信息
    - POST /api/auth/logout - 退出登录
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.4 实现数据 API 路由
    - 项目路由：GET/POST /api/projects, GET/PUT/DELETE /api/projects/:id
    - 表达路由：GET/POST /api/expressions, PUT/DELETE /api/expressions/:id
    - 闪卡路由：GET /api/flashcards/due, POST /api/flashcards/:id/review
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [x] 6.5 实现 Express 服务器入口
    - 配置 CORS、cookie-parser、JSON body parser
    - 注册所有路由
    - 配置错误处理中间件
    - 设置 Cookie 安全标志（HttpOnly, Secure）
    - _Requirements: 8.1, 8.3_

  - [ ]* 6.6 编写 API 路由属性测试
    - **Property 7: 请求频率限制**
    - **Property 8: Cookie 安全标志**
    - **Validates: Requirements 8.3, 8.4**

  - [ ]* 6.7 编写 API 路由集成测试
    - 使用 supertest 测试认证流程
    - 测试数据 API 端点
    - 测试错误响应格式
    - _Requirements: 4.8, 4.9_

- [x] 7. Checkpoint - 后端 API 验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 前端认证集成
  - [x] 8.1 创建 AuthContext 和 Provider
    - 创建 `src/context/AuthContext.tsx`
    - 实现 AuthContextValue 接口（user, isAuthenticated, isLoading, login, logout, checkAuth）
    - 实现应用启动时检查会话状态
    - _Requirements: 7.1, 7.5_

  - [x] 8.2 创建 ApiClient 服务
    - 创建 `src/services/ApiClient.ts`
    - 实现认证相关 API 调用（getLoginUrl, handleCallback, logout, getCurrentUser）
    - 实现数据 API 调用（projects, expressions, flashcards CRUD）
    - 配置 credentials: 'include' 发送 Cookie
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 8.3 编写前端认证测试
    - 测试 AuthContext 状态管理
    - 测试 ApiClient API 调用
    - 测试登录/登出流程
    - _Requirements: 7.1, 7.4, 7.6_

- [x] 9. 登录页面和用户界面
  - [x] 9.1 创建登录页面组件
    - 创建 `src/components/LoginPage/LoginPage.tsx`
    - 实现飞书登录按钮
    - 处理 OAuth 回调（从 URL 获取 code 和 state）
    - 显示登录错误信息
    - _Requirements: 7.2_

  - [x] 9.2 更新导航栏显示用户信息
    - 在导航栏添加用户头像和名称显示
    - 添加退出登录按钮
    - 根据登录状态显示/隐藏功能区
    - _Requirements: 7.3, 2.7_

  - [x] 9.3 集成 AuthContext 到应用
    - 在 App.tsx 中包装 AuthProvider
    - 实现路由保护（未登录重定向到登录页）
    - 处理会话过期自动重定向
    - _Requirements: 7.4, 7.6_

- [x] 10. 数据迁移功能
  - [x] 10.1 实现后端 MigrationService
    - 实现 `importLocalData()` 批量导入本地数据
    - 实现数据验证和错误处理
    - 实现导入失败回滚机制
    - 创建 POST /api/migration/import 端点
    - _Requirements: 6.4, 6.6_

  - [ ]* 10.2 编写 MigrationService 属性测试
    - **Property 9: 数据迁移完整性**
    - **Validates: Requirements 6.4**

  - [x] 10.3 实现前端数据迁移对话框
    - 创建 `src/components/MigrationDialog/MigrationDialog.tsx`
    - 检测本地 IndexedDB 数据
    - 显示迁移确认对话框
    - 显示迁移进度
    - 处理迁移成功/失败提示
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7_

  - [x] 10.4 集成数据迁移到登录流程
    - 首次登录后检测本地数据
    - 触发迁移对话框
    - 迁移完成后询问是否清除本地数据
    - _Requirements: 6.1, 6.2, 6.5_

- [x] 11. 数据层切换
  - [x] 11.1 创建数据服务抽象层
    - 创建 `src/services/DataProvider.ts` 接口
    - 实现 `LocalDataProvider`（使用现有 IndexedDB）
    - 实现 `RemoteDataProvider`（使用 ApiClient）
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 11.2 更新现有组件使用数据抽象层
    - 更新 ProjectManager 使用 DataProvider
    - 更新 ExpressionCollector 使用 DataProvider
    - 更新 FlashcardGenerator 使用 DataProvider
    - 根据登录状态自动切换数据源
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 12. Final Checkpoint - 完整功能验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 后端使用 TypeScript + Express，前端使用现有 React 架构
- 数据存储使用 JSON 文件，每用户独立目录
