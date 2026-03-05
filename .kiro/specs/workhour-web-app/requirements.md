# 需求文档

## 简介

本功能实现一个工时管理 Web 应用，替代现有的飞书机器人方案。管理员将网页链接发送给译员，译员点击链接进入 Web 应用，通过飞书 OAuth 登录后，系统自动展示该译员对应的"进行中"项目（口译和笔译分开），译员填写工时后系统自动汇总并回写至飞书多维表格的"工时统计/min"字段。

应用包含三个核心页面：工时填写页面（译员日常使用）、管理页面（管理员查看和管理数据）、数据分析页面（工时统计与可视化）。

后端复用现有 feishu-workhour-bot 中的 BitableService（飞书多维表格读写）和 TrackerService（本地数据存储）等服务代码。

## 词汇表

- **Web_App**: 工时管理 Web 应用，提供工时填写、管理和数据分析功能
- **Auth_Service**: 认证服务模块，负责飞书 OAuth 2.0 登录流程和会话管理
- **API_Server**: 后端 API 服务器，提供 RESTful 接口供前端调用
- **Bitable_Service**: 飞书多维表格服务，封装飞书 Bitable API 的读写操作
- **Tracker_Service**: 本地工时数据存储服务，管理译员和工时记录的持久化
- **Bitable（多维表格）**: 飞书多维表格，包含口译表（tblxCsMVGfag1mmZ）和笔译表（tbliA5bK8PsJ213l）
- **Translator（译员）**: 使用 Web 应用填报工时的用户，通过飞书 OAuth 登录
- **Project（项目）**: 飞书多维表格中的项目记录，包含项目名称、承接进度、工时统计等字段
- **Interpretation（口译）**: 口译类型的项目和工时记录
- **Translation（笔译）**: 笔译类型的项目和工时记录
- **Feishu_Open_ID**: 飞书用户唯一标识符，用于数据隔离和译员身份关联

---

## 需求

### 需求 1：飞书 OAuth 登录

**用户故事：** 作为译员，我希望通过飞书账号登录工时管理系统，以便使用企业统一身份认证并实现数据隔离。

#### 验收标准

1. WHEN 译员点击管理员分享的链接访问 Web_App, THE Auth_Service SHALL 检测用户是否已登录，未登录时重定向到飞书 OAuth 授权页面
2. WHEN 译员在飞书授权页面同意授权, THE Auth_Service SHALL 接收授权码并交换 Access_Token，随后调用飞书 API 获取用户信息（open_id、name、avatar）
3. WHEN 用户信息获取成功, THE Auth_Service SHALL 创建用户会话（JWT 令牌），设置到 HTTP-only Cookie，并重定向到工时填写页面
4. IF 授权码交换失败或用户取消授权, THEN THE Auth_Service SHALL 重定向到登录页面并显示对应错误提示
5. THE Auth_Service SHALL 在授权请求中包含 state 参数以防止 CSRF 攻击
6. THE Auth_Service SHALL 设置会话有效期为 7 天
7. WHEN 会话过期, THE Auth_Service SHALL 自动重定向用户到飞书 OAuth 授权页面重新登录

### 需求 2：动态读取进行中的项目列表

**用户故事：** 作为译员，我希望登录后自动看到飞书多维表格中"进行中"的项目，以便直接选择项目填写工时。

#### 验收标准

1. WHEN 译员登录成功并进入工时填写页面, THE API_Server SHALL 调用 Bitable_Service 从口译表和笔译表中分别读取所有"承接进度"字段值为"进行中"的项目记录
2. THE Web_App SHALL 将口译项目和笔译项目分开展示，每个类型独立显示项目列表
3. WHEN 口译表或笔译表中不存在"进行中"的项目, THE Web_App SHALL 在对应类型区域显示"暂无进行中的项目"提示
4. IF 读取飞书多维表格失败, THEN THE API_Server SHALL 返回错误信息，THE Web_App SHALL 显示错误提示并提供重试按钮
5. THE API_Server SHALL 每次请求时实时读取飞书多维表格，确保项目列表反映最新状态

### 需求 3：工时填写页面

**用户故事：** 作为译员，我希望在 Web 页面上方便地填写口译和笔译工时，以便快速完成工时填报。

#### 验收标准

1. THE Web_App SHALL 在工时填写页面展示两个独立区域：口译工时填写区和笔译工时填写区
2. THE Web_App SHALL 在每个区域中提供项目下拉选择框（从"进行中"项目动态加载）和工时输入框（单位：分钟，正整数）
3. THE Web_App SHALL 允许译员仅填写口译或仅填写笔译，两者均为可选，但提交时至少需填写其中一项
4. WHEN 译员输入的工时不为正整数, THE Web_App SHALL 在对应输入框旁显示格式错误提示
5. WHEN 译员选择了项目但未填写工时, THE Web_App SHALL 提示工时为必填
6. WHEN 译员填写了工时但未选择项目, THE Web_App SHALL 提示需选择对应项目
7. WHEN 译员点击提交按钮, THE API_Server SHALL 将工时记录写入 Tracker_Service，记录包含字段：translatorId、translatorName、projectId、projectName、type（interpretation/translation）、time（分钟数）、date（ISO 8601 格式时间戳）
8. WHEN 工时数据成功写入, THE Web_App SHALL 显示提交成功提示，并清空表单
9. IF 工时数据写入失败, THEN THE Web_App SHALL 显示提交失败提示并保留表单数据

### 需求 4：工时汇总回写飞书多维表格

**用户故事：** 作为管理员，我希望飞书多维表格中的"工时统计/min"字段能自动汇总所有译员在该项目下填报的工时，以便无需手动统计。

#### 验收标准

1. WHEN 工时数据成功写入 Tracker_Service 后, THE API_Server SHALL 读取该项目下所有译员的工时记录并计算总工时（分钟）
2. THE API_Server SHALL 调用 Bitable_Service 将计算得到的项目总工时更新至飞书多维表格中对应项目行的"工时统计/min"字段
3. IF 更新飞书多维表格失败, THEN THE API_Server SHALL 记录错误日志，THE Web_App SHALL 提示用户"本地记录已保存，但飞书表格同步失败"
4. THE API_Server SHALL 在每次有新工时提交时重新计算并覆盖更新"工时统计/min"字段，确保该字段始终反映所有译员的累计工时总和

### 需求 5：译员身份识别与数据隔离

**用户故事：** 作为系统，我需要识别登录的飞书用户身份，并将工时记录正确归属到对应译员，以便实现数据隔离。

#### 验收标准

1. THE API_Server SHALL 以飞书 Feishu_Open_ID 作为唯一标识符，在 Tracker_Service 中查找对应的译员记录
2. WHEN Tracker_Service 中不存在该 Feishu_Open_ID 对应的译员, THE API_Server SHALL 自动创建新译员记录，使用飞书用户名作为译员姓名
3. WHEN 译员查看工时填写页面, THE Web_App SHALL 在页面顶部显示当前登录译员的姓名和头像
4. THE Web_App SHALL 仅允许译员查看和提交自己的工时记录

### 需求 6：管理页面

**用户故事：** 作为管理员，我希望有一个管理页面查看所有译员的工时记录，以便进行工时审核和管理。

#### 验收标准

1. THE Web_App SHALL 提供管理页面，展示所有译员的工时记录列表
2. THE Web_App SHALL 在管理页面支持按译员姓名、项目名称、项目类型（口译/笔译）筛选工时记录
3. THE Web_App SHALL 在管理页面支持按提交日期范围筛选工时记录
4. THE Web_App SHALL 在管理页面以表格形式展示工时记录，包含列：译员姓名、项目名称、项目类型、工时（分钟）、提交日期
5. THE Web_App SHALL 在管理页面显示每个项目的工时汇总（所有译员工时总和）

### 需求 7：数据分析页面

**用户故事：** 作为管理员，我希望有一个数据分析页面查看工时统计和趋势，以便了解团队工作量分布。

#### 验收标准

1. THE Web_App SHALL 提供数据分析页面，展示工时统计概览（总工时、口译总工时、笔译总工时、译员人数）
2. THE Web_App SHALL 在数据分析页面展示按译员分组的工时柱状图
3. THE Web_App SHALL 在数据分析页面展示按项目分组的工时柱状图
4. THE Web_App SHALL 在数据分析页面支持按时间范围筛选统计数据
5. THE Web_App SHALL 在数据分析页面展示口译与笔译工时的占比饼图

### 需求 8：API 接口设计

**用户故事：** 作为开发者，我需要一套 RESTful API 接口，以便前端与后端进行数据交互。

#### 验收标准

1. THE API_Server SHALL 提供 GET /api/auth/feishu 接口发起飞书 OAuth 授权
2. THE API_Server SHALL 提供 GET /api/auth/feishu/callback 接口处理飞书 OAuth 回调
3. THE API_Server SHALL 提供 GET /api/auth/me 接口获取当前登录用户信息
4. THE API_Server SHALL 提供 POST /api/auth/logout 接口处理用户退出登录
5. THE API_Server SHALL 提供 GET /api/projects 接口获取进行中的项目列表（支持 type 参数筛选口译/笔译）
6. THE API_Server SHALL 提供 POST /api/time-records 接口提交工时记录
7. THE API_Server SHALL 提供 GET /api/time-records 接口查询工时记录（支持 translatorId、projectId、startDate、endDate 参数筛选）
8. THE API_Server SHALL 提供 GET /api/stats 接口获取工时统计数据（支持 startDate、endDate 参数）
9. WHEN API 请求缺少有效会话凭证, THE API_Server SHALL 返回 401 状态码
10. THE API_Server SHALL 对所有响应使用统一的 JSON 格式：{ success: boolean, data?: any, error?: string }

### 需求 9：部署与配置

**用户故事：** 作为开发者，我需要应用支持环境变量配置，以便在不同环境中部署。

#### 验收标准

1. THE API_Server SHALL 支持通过环境变量配置：飞书应用凭证（FEISHU_APP_ID、FEISHU_APP_SECRET）、多维表格配置（BITABLE_APP_TOKEN、INTERPRETATION_TABLE_ID、TRANSLATION_TABLE_ID）、JWT 密钥（JWT_SECRET）、服务端口（PORT）
2. THE API_Server SHALL 在启动时验证所有必需环境变量是否已配置，IF 缺少必需变量, THEN THE API_Server SHALL 输出缺失变量名称并终止启动
3. THE Web_App SHALL 使用 TypeScript 开发前后端代码
4. THE API_Server SHALL 复用现有 feishu-workhour-bot 中的 BitableService 和 TrackerService 服务代码
