# Requirements Document

## Introduction

本需求文档定义视译练习平台（Sight Translation Trainer）的飞书登录集成功能。该功能将实现：
1. 飞书 OAuth 2.0 登录认证
2. 基于飞书用户 ID 的数据隔离
3. 用户数据从浏览器 IndexedDB 迁移到服务端数据库

当前系统为纯前端 React 应用，使用 Dexie (IndexedDB) 存储数据。本次改造将引入后端服务，实现用户认证和数据持久化。

## Glossary

- **Auth_Service**: 认证服务模块，负责处理飞书 OAuth 登录流程和会话管理
- **API_Server**: 后端 API 服务器，提供 RESTful 接口供前端调用
- **Database_Service**: 数据库服务模块，负责用户数据的 CRUD 操作
- **Session_Manager**: 会话管理器，负责用户登录状态的维护和验证
- **Data_Migration_Service**: 数据迁移服务，负责将本地 IndexedDB 数据迁移到服务端
- **Feishu_User_ID**: 飞书用户唯一标识符，用于数据隔离
- **Access_Token**: 飞书 OAuth 授权后获取的访问令牌
- **Refresh_Token**: 用于刷新 Access_Token 的令牌

## Requirements

### Requirement 1: 飞书 OAuth 登录

**User Story:** 作为用户，我希望通过飞书账号登录系统，以便使用企业统一身份认证。

#### Acceptance Criteria

1. WHEN 用户点击"飞书登录"按钮, THE Auth_Service SHALL 重定向用户到飞书 OAuth 授权页面
2. WHEN 用户在飞书授权页面同意授权, THE Auth_Service SHALL 接收授权码并交换 Access_Token
3. WHEN Access_Token 获取成功, THE Auth_Service SHALL 调用飞书 API 获取用户信息（user_id、name、avatar）
4. WHEN 用户信息获取成功, THE Session_Manager SHALL 创建用户会话并返回会话凭证给前端
5. IF 授权码交换失败, THEN THE Auth_Service SHALL 返回错误信息并提示用户重新登录
6. IF 用户取消授权, THEN THE Auth_Service SHALL 重定向用户到登录页面并显示取消提示
7. THE Auth_Service SHALL 在授权请求中包含 state 参数以防止 CSRF 攻击

### Requirement 2: 会话管理

**User Story:** 作为用户，我希望登录状态能够持久保持，以便不需要频繁重新登录。

#### Acceptance Criteria

1. WHEN 用户登录成功, THE Session_Manager SHALL 生成 JWT 令牌并设置到 HTTP-only Cookie
2. WHEN 用户发起 API 请求, THE Session_Manager SHALL 验证请求中的会话凭证有效性
3. WHEN 会话凭证有效, THE Session_Manager SHALL 允许请求继续处理
4. IF 会话凭证无效或过期, THEN THE Session_Manager SHALL 返回 401 状态码
5. WHEN Access_Token 即将过期（剩余时间少于 30 分钟）, THE Session_Manager SHALL 使用 Refresh_Token 自动刷新
6. IF Refresh_Token 刷新失败, THEN THE Session_Manager SHALL 要求用户重新登录
7. WHEN 用户点击"退出登录", THE Session_Manager SHALL 清除会话凭证并重定向到登录页面
8. THE Session_Manager SHALL 设置会话有效期为 7 天

### Requirement 3: 用户数据隔离

**User Story:** 作为用户，我希望只能看到自己的数据，以便保护个人隐私和数据安全。

#### Acceptance Criteria

1. THE Database_Service SHALL 在所有数据表中添加 user_id 字段作为数据隔离标识
2. WHEN 用户创建项目, THE Database_Service SHALL 自动关联当前用户的 Feishu_User_ID
3. WHEN 用户查询项目列表, THE Database_Service SHALL 仅返回属于当前用户的项目
4. WHEN 用户查询表达列表, THE Database_Service SHALL 仅返回属于当前用户项目的表达
5. WHEN 用户查询闪卡列表, THE Database_Service SHALL 仅返回属于当前用户的闪卡
6. IF 用户尝试访问其他用户的数据, THEN THE API_Server SHALL 返回 403 状态码
7. THE Database_Service SHALL 通过用户目录隔离确保数据访问安全

### Requirement 4: 后端 API 服务

**User Story:** 作为开发者，我希望有一套 RESTful API 接口，以便前端能够与服务端进行数据交互。

#### Acceptance Criteria

1. THE API_Server SHALL 提供 POST /api/auth/feishu/callback 接口处理飞书 OAuth 回调
2. THE API_Server SHALL 提供 GET /api/auth/me 接口获取当前登录用户信息
3. THE API_Server SHALL 提供 POST /api/auth/logout 接口处理用户退出登录
4. THE API_Server SHALL 提供 CRUD 接口管理项目资源（/api/projects）
5. THE API_Server SHALL 提供 CRUD 接口管理表达资源（/api/expressions）
6. THE API_Server SHALL 提供 CRUD 接口管理闪卡资源（/api/flashcards）
7. THE API_Server SHALL 提供 CRUD 接口管理复习记录资源（/api/review-records）
8. WHEN API 请求缺少有效会话凭证, THE API_Server SHALL 返回 401 状态码
9. THE API_Server SHALL 对所有响应使用统一的 JSON 格式

### Requirement 5: JSON 文件持久化

**User Story:** 作为用户，我希望数据存储在服务端，以便在不同设备上访问相同的数据。

#### Acceptance Criteria

1. THE Database_Service SHALL 使用 JSON 文件存储用户数据，每个用户一个独立目录
2. THE Database_Service SHALL 在用户目录下创建 user.json 存储用户信息（feishu_user_id、name、avatar、created_at、updated_at）
3. THE Database_Service SHALL 在用户目录下创建 projects.json 存储该用户的所有项目数据
4. THE Database_Service SHALL 在用户目录下创建 expressions.json 存储该用户的所有表达数据
5. THE Database_Service SHALL 在用户目录下创建 flashcards.json 存储该用户的所有闪卡数据
6. THE Database_Service SHALL 在用户目录下创建 review-records.json 存储该用户的所有复习记录
7. THE Database_Service SHALL 为所有数据对象添加 created_at 和 updated_at 时间戳字段
8. THE Database_Service SHALL 使用文件锁机制防止并发写入冲突
9. THE Database_Service SHALL 在写入前创建备份文件，写入失败时自动回滚

### Requirement 6: 本地数据迁移

**User Story:** 作为现有用户，我希望能够将本地 IndexedDB 中的数据迁移到服务端，以便保留历史数据。

#### Acceptance Criteria

1. WHEN 用户首次登录, THE Data_Migration_Service SHALL 检测本地 IndexedDB 是否存在数据
2. WHEN 检测到本地数据, THE Data_Migration_Service SHALL 提示用户是否迁移数据到服务端
3. WHEN 用户确认迁移, THE Data_Migration_Service SHALL 读取本地所有项目、表达、闪卡和复习记录
4. WHEN 数据读取完成, THE Data_Migration_Service SHALL 批量上传数据到服务端并关联当前用户
5. WHEN 迁移成功, THE Data_Migration_Service SHALL 提示用户迁移完成并询问是否清除本地数据
6. IF 迁移过程中发生错误, THEN THE Data_Migration_Service SHALL 回滚已上传的数据并提示用户重试
7. THE Data_Migration_Service SHALL 显示迁移进度（已迁移项目数/总项目数）

### Requirement 7: 前端认证状态管理

**User Story:** 作为用户，我希望界面能够正确显示登录状态，以便了解当前的认证情况。

#### Acceptance Criteria

1. WHEN 应用启动, THE Auth_Service SHALL 检查是否存在有效会话
2. WHILE 用户未登录, THE Auth_Service SHALL 显示登录页面并隐藏主功能区
3. WHILE 用户已登录, THE Auth_Service SHALL 在导航栏显示用户头像和名称
4. WHEN 会话过期, THE Auth_Service SHALL 自动重定向用户到登录页面
5. THE Auth_Service SHALL 在 React Context 中维护全局认证状态
6. WHEN 用户登录成功, THE Auth_Service SHALL 更新全局认证状态并跳转到主页面

### Requirement 8: 安全性要求

**User Story:** 作为系统管理员，我希望系统具备基本的安全防护，以便保护用户数据安全。

#### Acceptance Criteria

1. THE API_Server SHALL 使用 HTTPS 协议传输所有数据
2. THE API_Server SHALL 对敏感配置（飞书 App Secret、数据库密码）使用环境变量存储
3. THE Session_Manager SHALL 使用 HTTP-only 和 Secure 标志设置 Cookie
4. THE API_Server SHALL 实现请求频率限制，每个 IP 每分钟最多 100 次请求
5. THE Database_Service SHALL 验证文件路径防止目录遍历攻击
6. THE API_Server SHALL 验证所有用户输入数据的格式和长度
7. THE Auth_Service SHALL 验证 OAuth state 参数防止 CSRF 攻击
