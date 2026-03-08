# 需求文档：练习打卡功能

## 简介

为视译练习网站增加"打卡"功能。用户在练习视图中滚动到底部后，可以点击打卡按钮标记该项目已完成视译练习。打卡后，项目列表页面显示打卡完成状态和总用时；再次进入该项目时不再启动计时器。

## 术语表

- **PracticeView**：练习视图组件，用户在此进行视译练习，包含中英文双栏、计时器等
- **ProjectList**：项目列表组件，展示所有项目卡片
- **Project**：项目数据模型，包含中英文段落对、练习进度等字段
- **DataService**：前端数据服务层，负责与后端 API 通信
- **Server_DataService**：后端数据服务层，负责读写 JSON 文件存储
- **Timer**：练习计时器，每秒递增，每 30 秒自动保存累计时间
- **CheckIn**：打卡操作，标记项目练习完成

## 需求

### 需求 1：项目数据模型扩展

**用户故事：** 作为开发者，我希望项目数据模型包含打卡状态字段，以便系统能持久化记录项目的打卡完成状态。

#### 验收标准

1. THE Project 数据模型 SHALL 包含 `checkedIn` 布尔字段，表示该项目是否已打卡完成
2. THE Project 数据模型 SHALL 包含 `checkedInAt` 日期字段，记录打卡完成的时间
3. WHEN `checkedIn` 字段未设置时，THE Project 数据模型 SHALL 将其默认值视为 `false`，以保持与已有项目数据的向后兼容

### 需求 2：练习视图打卡按钮

**用户故事：** 作为用户，我希望在练习视图滚动到底部时看到打卡按钮，以便我完成练习后可以标记项目为已完成。

#### 验收标准

1. WHILE PracticeView 处于练习模式且项目未打卡，THE PracticeView SHALL 在内容区域底部显示一个"打卡"按钮
2. WHEN 用户点击"打卡"按钮，THE PracticeView SHALL 向后端发送打卡请求，将项目标记为已完成
3. WHEN 打卡请求成功完成，THE PracticeView SHALL 显示打卡成功的提示信息
4. WHEN 打卡请求成功完成，THE PracticeView SHALL 停止计时器并保存最终累计练习时间
5. IF 打卡请求失败，THEN THE PracticeView SHALL 显示错误提示信息，并保留打卡按钮供用户重试
6. WHILE 项目已打卡完成，THE PracticeView SHALL 在内容区域底部显示"已打卡完成"状态标识替代打卡按钮

### 需求 3：已打卡项目禁用计时

**用户故事：** 作为用户，我希望再次进入已打卡的项目时不会启动计时器，以便已完成的项目不会继续累计练习时间。

#### 验收标准

1. WHEN 用户进入一个已打卡完成的项目，THE Timer SHALL 不启动，保持显示已保存的最终累计练习时间
2. WHILE 项目已打卡完成，THE PracticeView SHALL 不执行每 30 秒的自动保存进度操作

### 需求 4：项目列表打卡状态展示

**用户故事：** 作为用户，我希望在项目列表中看到哪些项目已完成打卡以及总用时，以便我快速了解练习进度。

#### 验收标准

1. WHEN 项目已打卡完成，THE ProjectList SHALL 在该项目卡片上显示"打卡完成"徽章
2. WHEN 项目已打卡完成，THE ProjectList SHALL 在该项目卡片上显示总练习用时（格式为 HH:MM:SS）
3. WHEN 项目未打卡，THE ProjectList SHALL 不显示打卡相关的徽章和用时信息

### 需求 5：打卡 API 接口

**用户故事：** 作为开发者，我希望后端提供打卡 API 接口，以便前端可以持久化打卡状态。

#### 验收标准

1. THE Server_DataService SHALL 提供打卡接口，接收项目 ID 并将该项目标记为已打卡完成
2. WHEN 打卡接口被调用，THE Server_DataService SHALL 将 `checkedIn` 设为 `true`，将 `checkedInAt` 设为当前时间，并保存最终累计练习时间
3. IF 指定的项目 ID 不存在，THEN THE Server_DataService SHALL 返回 404 错误
4. IF 项目已经打卡完成，THEN THE Server_DataService SHALL 返回成功响应而不重复修改数据（幂等性）
