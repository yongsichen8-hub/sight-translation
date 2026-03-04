# 需求文档

## 简介

本功能在现有 workhour-tracker 工时追踪平台的基础上，实现与飞书的深度联动。译员无需打开网页平台，只需在飞书中向机器人发送"工时"关键词，即可触发工时填报问卷。问卷中的项目列表动态读取飞书多维表格中"进行中"的项目，用户填写口译和笔译工时（以分钟为单位）后提交，数据自动录入本地 workhour-tracker 平台，并将同一项目下所有译员的工时汇总后回写至飞书多维表格的"工时统计/min"字段。

## 词汇表

- **Bot（机器人）**：部署在飞书平台上的应用机器人，负责接收用户消息并推送互动卡片
- **Card（互动卡片）**：飞书消息卡片，用于展示问卷表单，支持用户在飞书内直接填写并提交数据
- **Bitable（多维表格）**：飞书多维表格，包含项目管理表和工时统计表两张数据表
- **Project_Table（项目管理表）**：飞书多维表格中存储项目信息的数据表，包含项目名称和项目状态字段
- **Workhour_Table（工时统计表）**：飞书多维表格中存储工时汇总数据的数据表，包含"工时统计/min"字段
- **Tracker（本地追踪平台）**：现有的 workhour-tracker 网页平台，以 localStorage 存储工时记录
- **Webhook_Server（Webhook 服务器）**：接收飞书事件回调的后端服务，负责业务逻辑处理
- **Translator（译员）**：使用飞书机器人填报工时的用户
- **Interpretation（口译）**：口译类型的工时记录
- **Translation（笔译）**：笔译类型的工时记录

---

## 需求

### 需求 1：机器人消息监听与问卷触发

**用户故事：** 作为译员，我希望在飞书中向机器人发送"工时"关键词，机器人能自动弹出工时填报问卷，这样我无需离开飞书即可完成工时填报。

#### 验收标准

1. WHEN 飞书用户在与 Bot 的单聊会话中发送包含"工时"关键词的消息，THE Bot SHALL 在该会话中回复一张工时填报互动卡片（Card）
2. WHEN 飞书用户发送不包含"工时"关键词的消息，THE Bot SHALL 回复提示消息，告知用户发送"工时"可触发填报问卷
3. THE Webhook_Server SHALL 在接收到飞书消息事件后 3 秒内完成响应，返回 HTTP 200 状态码以确认事件接收
4. IF Webhook_Server 接收到重复的事件 ID（event_id），THEN THE Webhook_Server SHALL 忽略该重复事件并直接返回 HTTP 200 状态码
5. THE Webhook_Server SHALL 验证飞书请求签名，IF 签名验证失败，THEN THE Webhook_Server SHALL 拒绝该请求并返回 HTTP 403 状态码

---

### 需求 2：动态读取进行中的项目列表

**用户故事：** 作为译员，我希望问卷中的项目选项能自动同步飞书多维表格中"进行中"的项目，这样我不需要手动维护项目列表。

#### 验收标准

1. WHEN Bot 需要推送工时填报卡片，THE Webhook_Server SHALL 从 Project_Table 中读取所有状态为"进行中"的项目记录
2. THE Card SHALL 将读取到的"进行中"项目以单选题形式展示，供译员选择口译项目和笔译项目
3. WHEN Project_Table 中不存在状态为"进行中"的项目，THE Bot SHALL 向用户发送提示消息，告知当前无可填报的进行中项目
4. IF 读取 Project_Table 失败，THEN THE Webhook_Server SHALL 向用户发送错误提示消息，并记录错误日志
5. THE Webhook_Server SHALL 每次触发问卷时实时读取 Project_Table，确保项目列表反映最新状态

---

### 需求 3：工时填报问卷表单

**用户故事：** 作为译员，我希望在飞书互动卡片中填写口译和笔译工时，这样我可以在不离开飞书的情况下完成填报。

#### 验收标准

1. THE Card SHALL 包含以下填报字段：口译项目单选（从进行中项目动态生成）、口译工时输入框（分钟，整数）、笔译项目单选（从进行中项目动态生成）、笔译工时输入框（分钟，整数）
2. THE Card SHALL 允许译员仅填写口译或仅填写笔译，两者均为可选，但至少需填写其中一项
3. WHEN 译员提交的口译工时或笔译工时不为正整数，THE Card SHALL 提示输入格式错误，并阻止提交
4. WHEN 译员选择了某类型项目但未填写对应工时，THE Card SHALL 提示该字段为必填，并阻止提交
5. WHEN 译员填写了某类型工时但未选择对应项目，THE Card SHALL 提示需选择对应项目，并阻止提交
6. THE Card SHALL 在提交按钮旁显示"取消"按钮，WHEN 译员点击取消，THE Bot SHALL 关闭当前卡片表单

---

### 需求 4：工时数据录入本地追踪平台

**用户故事：** 作为管理员，我希望译员通过飞书提交的工时数据能自动录入 workhour-tracker 平台，这样我可以在平台上统一查看所有工时记录。

#### 验收标准

1. WHEN 译员在 Card 中提交工时数据，THE Webhook_Server SHALL 将工时记录写入 Tracker 的数据存储
2. THE Webhook_Server SHALL 按照 Tracker 现有数据格式写入工时记录，包含字段：translatorId、translatorName、projectId、projectName、type（interpretation/translation）、time（分钟数）、date（ISO 8601 格式时间戳）
3. WHEN 飞书用户在 Tracker 中不存在对应译员记录，THE Webhook_Server SHALL 自动在 Tracker 中创建该译员记录，使用飞书用户名作为译员姓名
4. IF 写入 Tracker 数据存储失败，THEN THE Webhook_Server SHALL 向译员发送失败提示消息，并记录错误日志，不执行后续的飞书多维表格回写操作
5. WHEN 工时数据成功写入 Tracker，THE Bot SHALL 向译员发送确认消息，告知提交成功

---

### 需求 5：工时汇总回写飞书多维表格

**用户故事：** 作为管理员，我希望飞书多维表格中的"工时统计/min"字段能自动汇总所有译员在该项目下填报的工时，这样我无需手动统计。

#### 验收标准

1. WHEN 工时数据成功写入 Tracker 后，THE Webhook_Server SHALL 读取 Tracker 中该项目下所有译员的工时记录，计算总工时
2. THE Webhook_Server SHALL 将计算得到的项目总工时（口译工时 + 笔译工时之和）更新至 Workhour_Table 中对应项目行的"工时统计/min"字段
3. WHEN Workhour_Table 中不存在对应项目行，THE Webhook_Server SHALL 在 Workhour_Table 中新建该项目行并写入工时数据
4. IF 更新 Workhour_Table 失败，THEN THE Webhook_Server SHALL 向译员发送提示消息，告知本地记录已保存但飞书表格同步失败，并记录错误日志
5. THE Webhook_Server SHALL 在每次有新工时提交时重新计算并覆盖更新"工时统计/min"字段，确保该字段始终反映所有译员的累计工时总和

---

### 需求 6：飞书用户身份识别

**用户故事：** 作为系统，我需要能够识别发送消息的飞书用户身份，并将其与 Tracker 中的译员记录关联，这样工时记录才能正确归属到对应译员。

#### 验收标准

1. THE Webhook_Server SHALL 从飞书消息事件中提取发送者的 open_id 和用户名
2. THE Webhook_Server SHALL 以飞书 open_id 作为唯一标识符，在 Tracker 中查找对应的译员记录
3. WHEN Tracker 中不存在该 open_id 对应的译员，THE Webhook_Server SHALL 自动创建新译员记录，并将飞书 open_id 存储为译员的外部标识符
4. THE Webhook_Server SHALL 调用飞书用户信息 API 获取用户的真实姓名，用于在 Tracker 中展示译员姓名
5. IF 获取飞书用户信息失败，THEN THE Webhook_Server SHALL 使用飞书 open_id 作为译员姓名的备用值

---

### 需求 7：Webhook 服务器部署与配置

**用户故事：** 作为开发者，我需要一个可配置的 Webhook 服务器来处理飞书事件，这样整个联动流程才能正常运行。

#### 验收标准

1. THE Webhook_Server SHALL 提供 HTTP POST 接口用于接收飞书事件订阅回调
2. THE Webhook_Server SHALL 支持通过环境变量配置飞书应用凭证（App ID、App Secret）、多维表格 ID、数据表 ID 等参数
3. THE Webhook_Server SHALL 支持飞书事件订阅的 URL 验证（Challenge 验证）机制
4. THE Webhook_Server SHALL 将运行日志输出到控制台，日志内容包含事件类型、处理结果和错误信息
5. WHERE 开发环境，THE Webhook_Server SHALL 支持通过 ngrok 等内网穿透工具暴露本地服务以接收飞书回调
