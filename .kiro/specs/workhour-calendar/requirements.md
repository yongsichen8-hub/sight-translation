# 需求文档

## 简介

本功能实现一个个人工作时间追踪日历应用，帮助用户记录工作日（周一至周五）每小时的工作内容。应用包含三个主页面：日历（主页面）、OKR、灵感。日历页面支持分类记录工作事项和定时弹窗提醒填写；OKR 页面支持按季度填写目标和关键结果；灵感页面支持随手记录灵感和待办并进行分类。应用通过 AI（DeepSeek API）自动总结日/周/月/季度工作内容，并结合用户 OKR 数据分析工作是否在推进 OKR，辅助用户进行 PDCA 和述职。UI 采用日杂风格设计，色彩活泼且页面整洁。代码放置在 `calendar/` 目录下。

## 词汇表

- **Calendar_App**: 工作时间追踪日历应用，包含前端界面和后端服务
- **Auth_Service**: 认证服务模块，负责用户注册、登录和会话管理
- **User（用户）**: 使用 Calendar_App 记录工作内容的个人
- **Work_Entry（工作条目）**: 用户在某个时间段内填写的一条工作记录，包含分类、子分类和具体描述
- **Category（分类）**: 全局共享的一级分类，OKR 的 Objective 和日历的 Work_Entry 使用同一套分类体系。用户只需维护一套分类列表。默认分类包括"高管"、"培训"、"语言组"、"自我提升"、"其他"。其中"其他"分类表示与 OKR 无关的事项
- **Sub_Category（子分类）**: 分类下的二级细分，描述具体做了什么事情
- **Time_Slot（时间段）**: 工作日中的一个小时区间，如 9:00-10:00、10:00-11:00 等
- **Reminder（提醒弹窗）**: 每小时自动弹出的提示窗口，提醒用户填写过去一小时的工作内容
- **AI_Summary_Service**: AI 总结服务，调用 DeepSeek API 生成工作内容总结
- **Calendar_View（日历视图）**: 以周一至周五为列的日历界面，展示每日各时间段的工作记录
- **API_Server**: 后端 API 服务器，提供 RESTful 接口供前端调用
- **Navigation_Bar（导航栏）**: 应用顶部或侧边的页面切换导航组件，包含日历、OKR、灵感三个入口
- **OKR_Page（OKR 页面）**: OKR 管理页面，用户按季度填写目标和关键结果
- **Objective（目标）**: OKR 中的 O，用户设定的季度目标
- **Key_Result（关键结果）**: OKR 中的 KR，衡量目标达成的可量化指标
- **Inspiration_Page（灵感页面）**: 灵感与待办记录页面，用户随手记录工作灵感和待办事项
- **Inspiration_Entry（灵感条目）**: 用户记录的一条灵感或待办，包含内容、分类和类型（灵感/待办）
- **Inspiration_Category（灵感分类）**: 灵感和待办的分类标签，用于组织和筛选条目

---

## 需求

### 需求 1：用户注册与登录

**用户故事：** 作为用户，我希望通过用户名和密码注册并登录系统，以便我的工作记录与其他用户隔离。

#### 验收标准

1. THE Calendar_App SHALL 提供用户注册页面，包含用户名输入框、密码输入框、确认密码输入框和注册按钮
2. WHEN 用户提交注册表单, THE Auth_Service SHALL 验证用户名长度为 3 至 20 个字符，密码长度为 6 至 30 个字符
3. WHEN 用户名已被其他用户注册, THE Auth_Service SHALL 返回"用户名已存在"错误提示
4. WHEN 密码与确认密码不一致, THE Calendar_App SHALL 在提交前显示"两次密码输入不一致"提示
5. WHEN 注册成功, THE Auth_Service SHALL 使用 bcrypt 对密码进行哈希存储，并自动登录用户跳转到日历视图
6. THE Calendar_App SHALL 提供登录页面，包含用户名输入框、密码输入框和登录按钮
7. WHEN 用户提交正确的用户名和密码, THE Auth_Service SHALL 创建 JWT 会话令牌并设置到 HTTP-only Cookie，会话有效期为 7 天
8. IF 用户名不存在或密码错误, THEN THE Auth_Service SHALL 返回"用户名或密码错误"提示，不区分具体原因
9. WHEN 用户点击退出登录, THE Auth_Service SHALL 清除会话令牌并重定向到登录页面
10. THE API_Server SHALL 对所有需要认证的接口验证 JWT 令牌有效性，IF 令牌无效或过期, THEN THE API_Server SHALL 返回 401 状态码

### 需求 2：日历视图展示

**用户故事：** 作为用户，我希望看到一个以周一至周五为列的日历界面，以便直观查看每天每小时的工作记录。

#### 验收标准

1. THE Calendar_View SHALL 以周为单位展示，列为周一至周五（5 列），行为 9:00 至 18:30 的每小时时间段（共 10 行：9:00-10:00、10:00-11:00、11:00-12:00、12:00-13:00、13:00-14:00、14:00-15:00、15:00-16:00、16:00-17:00、17:00-18:00、18:00-18:30）
2. THE Calendar_View SHALL 默认显示当前周的日历，并在顶部显示当前周的日期范围（如"2025年1月6日 - 2025年1月10日"）
3. THE Calendar_View SHALL 提供"上一周"和"下一周"导航按钮，允许用户切换查看不同周的记录
4. WHEN 某个 Time_Slot 已有 Work_Entry 记录, THE Calendar_View SHALL 在对应单元格中显示分类标签和简要描述
5. WHEN 某个 Time_Slot 有多条 Work_Entry, THE Calendar_View SHALL 在对应单元格中依次展示所有条目，每条以分类颜色标签区分
6. WHEN 用户点击某个 Time_Slot 单元格, THE Calendar_App SHALL 打开该时间段的工作条目编辑弹窗
7. THE Calendar_View SHALL 采用日杂风格设计，使用柔和活泼的配色方案，页面布局简洁清晰
8. THE Calendar_View SHALL 对当前日期所在列添加视觉高亮标识

### 需求 3：工作条目填写

**用户故事：** 作为用户，我希望为每个小时时间段填写工作内容，支持分类选择和多条记录，以便详细追踪零散的工作事项。

#### 验收标准

1. WHEN 用户打开某个 Time_Slot 的编辑弹窗, THE Calendar_App SHALL 显示该时间段已有的 Work_Entry 列表和"添加条目"按钮
2. THE Calendar_App SHALL 为每条 Work_Entry 提供：Category 下拉选择框、Sub_Category 输入框、描述文本输入框
3. THE Calendar_App SHALL 提供默认的 Category 选项列表：高管、培训、语言组、自我提升、其他
4. THE Calendar_App SHALL 允许用户自定义新增 Category，新增的 Category 保存后对该用户后续填写可用
5. WHEN 用户在一个 Time_Slot 中添加多条 Work_Entry, THE Calendar_App SHALL 支持逐条添加，每条独立选择 Category 和填写描述
6. WHEN 用户点击保存按钮, THE API_Server SHALL 将该 Time_Slot 的所有 Work_Entry 持久化存储，每条记录包含字段：userId、date（ISO 8601 格式）、timeSlot（如 "09:00-10:00"）、category、subCategory、description、createdAt、updatedAt
7. WHEN 用户点击某条已有 Work_Entry 的删除按钮, THE Calendar_App SHALL 弹出确认对话框，确认后删除该条目
8. IF 保存 Work_Entry 失败, THEN THE Calendar_App SHALL 显示错误提示并保留用户已填写的内容

### 需求 4：定时提醒弹窗

**用户故事：** 作为用户，我希望系统每小时自动弹窗提醒我填写过去一小时的工作内容，因为依靠自己记忆去填写太困难了。

#### 验收标准

1. WHILE 用户已登录且当前时间在工作日（周一至周五）的 10:00 至 18:30 范围内, THE Calendar_App SHALL 在每个整点（10:00、11:00、12:00、13:00、14:00、15:00、16:00、17:00、18:00）以及 18:30 自动弹出 Reminder 弹窗
2. THE Reminder SHALL 显示提示文字"请填写过去一小时的工作内容"，并标明对应的 Time_Slot（如"9:00-10:00"）
3. THE Reminder SHALL 提供"立即填写"按钮，点击后打开对应 Time_Slot 的工作条目编辑弹窗
4. THE Reminder SHALL 提供"稍后提醒"按钮，点击后关闭弹窗，并在 15 分钟后再次弹出提醒
5. THE Reminder SHALL 提供"跳过"按钮，点击后关闭弹窗且不再对该 Time_Slot 重复提醒
6. WHEN 用户已填写过某个 Time_Slot 的 Work_Entry, THE Calendar_App SHALL 跳过该 Time_Slot 的自动提醒
7. THE Calendar_App SHALL 使用浏览器 Notification API 发送提醒，WHEN 用户首次登录, THE Calendar_App SHALL 请求浏览器通知权限

### 需求 5：分类管理

**用户故事：** 作为用户，我希望管理工作分类列表，以便分类体系符合我的实际工作内容。

#### 验收标准

1. THE Calendar_App SHALL 提供分类管理页面，展示当前用户的所有 Category 及其使用次数（包含 Work_Entry 使用次数和 Objective 关联次数）
2. THE Calendar_App SHALL 允许用户新增 Category，新增时需输入分类名称
3. THE Calendar_App SHALL 允许用户编辑已有 Category 的名称，编辑后所有关联的 Work_Entry 和 Objective 同步更新
4. WHEN 用户删除某个 Category, THE Calendar_App SHALL 检查该 Category 是否有关联的 Work_Entry 或 Objective，IF 存在关联记录, THEN THE Calendar_App SHALL 提示用户选择将关联记录迁移到其他 Category 或标记为"其他"
5. THE Calendar_App SHALL 为每个 Category 分配一个可区分的颜色标签，用于在 Calendar_View 和 OKR_Page 中视觉区分
6. THE API_Server SHALL 将 Category 数据按用户隔离存储，每个用户维护独立的分类列表
7. THE Calendar_App SHALL 确保 OKR_Page 中的 Objective 和 Calendar_View 中的 Work_Entry 共用同一套 Category 分类列表，用户在分类管理中的变更同时影响两者
8. THE Calendar_App SHALL 将"其他"作为内置默认分类，不允许用户删除该分类

### 需求 6：AI 工作总结

**用户故事：** 作为用户，我希望 AI 能帮我总结指定时间范围的工作内容，以便辅助我进行 OKR 的 PDCA 和述职。

#### 验收标准

1. THE Calendar_App SHALL 提供 AI 总结功能入口，允许用户选择总结范围：日总结、周总结、月总结、季度总结
2. WHEN 用户选择"日总结"并指定日期, THE AI_Summary_Service SHALL 读取该日期所有 Time_Slot 的 Work_Entry，调用 DeepSeek API 生成当日工作总结
3. WHEN 用户选择"周总结"并指定周, THE AI_Summary_Service SHALL 读取该周周一至周五所有 Work_Entry，调用 DeepSeek API 生成周工作总结
4. WHEN 用户选择"月总结"并指定月份, THE AI_Summary_Service SHALL 读取该月所有工作日的 Work_Entry，调用 DeepSeek API 生成月工作总结
5. WHEN 用户选择"季度总结"并指定季度, THE AI_Summary_Service SHALL 读取该季度所有工作日的 Work_Entry，调用 DeepSeek API 生成季度工作总结
6. THE AI_Summary_Service SHALL 在总结中按 Category 分组归纳工作内容，并提炼关键成果和时间分配比例
7. THE AI_Summary_Service SHALL 将 Category 为"其他"的 Work_Entry 识别为与 OKR 无关的事项，在总结中单独归类为"非 OKR 相关工作"，不纳入 OKR 推进分析
8. WHEN 用户的 OKR_Page 中存在当前季度的 Objective 和 Key_Result 数据, THE AI_Summary_Service SHALL 在生成总结时读取该季度 OKR 数据，通过 Objective 关联的 Category 匹配对应的 Work_Entry，分析工作内容与 OKR 的关联度，评估各 Key_Result 的推进情况
9. THE AI_Summary_Service SHALL 在总结报告中包含"OKR 推进分析"章节，列出每个 Objective 下各 Key_Result 的推进状态和相关工作内容
10. THE Calendar_App SHALL 在总结生成过程中显示加载状态，生成完成后展示总结内容
11. THE Calendar_App SHALL 允许用户复制总结文本到剪贴板
12. THE Calendar_App SHALL 保存历史总结记录，用户可查看之前生成的总结
13. THE API_Server SHALL 通过环境变量 DEEPSEEK_API_KEY 配置 DeepSeek API 密钥
14. IF DeepSeek API 调用失败, THEN THE AI_Summary_Service SHALL 返回错误提示"AI 总结生成失败，请稍后重试"

### 需求 7：数据存储与隔离

**用户故事：** 作为用户，我希望我的工作记录与其他用户完全隔离，以便保护个人工作数据隐私。

#### 验收标准

1. THE API_Server SHALL 使用 SQLite 数据库存储所有用户数据、工作条目、分类和 AI 总结记录
2. THE API_Server SHALL 在所有数据查询中以 userId 作为过滤条件，确保用户仅能访问自己的数据
3. THE API_Server SHALL 对所有写入操作验证当前会话用户与目标数据的 userId 一致性，IF 不一致, THEN THE API_Server SHALL 返回 403 状态码
4. THE API_Server SHALL 在数据库中为 userId + date + timeSlot 建立索引，优化按日期和时间段的查询性能

### 需求 8：UI 设计风格

**用户故事：** 作为用户，我希望应用界面采用日杂风格设计，色彩活泼且页面干净，以便使用时心情愉悦。

#### 验收标准

1. THE Calendar_App SHALL 使用柔和暖色调为主色系（如奶油白背景、淡粉/淡蓝/淡绿等点缀色）
2. THE Calendar_App SHALL 使用圆角卡片式布局，元素间保持充足留白
3. THE Calendar_App SHALL 使用手写感或圆润的中文字体风格（如思源黑体圆角变体或类似字体）
4. THE Calendar_App SHALL 为不同 Category 分配柔和且可区分的色彩标签（如淡粉、淡蓝、淡绿、淡黄、淡紫等）
5. THE Calendar_App SHALL 在交互元素（按钮、卡片）上添加轻微的阴影和过渡动画效果
6. THE Calendar_App SHALL 确保页面在 1280px 及以上宽度的屏幕上正常显示，日历表格不出现水平滚动

### 需求 9：技术架构与部署

**用户故事：** 作为开发者，我需要明确的技术栈和部署配置，以便顺利开发和部署应用。

#### 验收标准

1. THE Calendar_App SHALL 使用 React + TypeScript 开发前端，使用 Vite 作为构建工具
2. THE API_Server SHALL 使用 Node.js + Express + TypeScript 开发后端
3. THE API_Server SHALL 使用 SQLite（通过 better-sqlite3）作为数据库
4. THE Calendar_App SHALL 将前端代码放置在 `calendar/client/` 目录，后端代码放置在 `calendar/server/` 目录
5. THE API_Server SHALL 支持通过环境变量配置：JWT_SECRET、DEEPSEEK_API_KEY、PORT（默认 3200）、DATABASE_PATH（默认 ./data/calendar.db）
6. THE API_Server SHALL 在启动时自动创建数据库表结构（如表不存在则创建）
7. IF 必需环境变量 JWT_SECRET 未配置, THEN THE API_Server SHALL 输出缺失变量名称并终止启动


### 需求 10：页面导航

**用户故事：** 作为用户，我希望在日历、OKR、灵感三个页面之间自由切换，以便快速访问不同功能模块。

#### 验收标准

1. THE Calendar_App SHALL 提供 Navigation_Bar，包含"日历"、"OKR"、"灵感"三个导航入口
2. THE Navigation_Bar SHALL 默认选中"日历"页面作为应用主页面
3. WHEN 用户点击 Navigation_Bar 中的某个导航入口, THE Calendar_App SHALL 切换到对应页面，并高亮当前选中的导航项
4. THE Navigation_Bar SHALL 在所有三个页面中保持可见，允许用户随时切换页面
5. THE Navigation_Bar SHALL 采用与整体日杂风格一致的设计，使用图标加文字的组合形式展示导航项

### 需求 11：OKR 管理

**用户故事：** 作为用户，我希望按季度填写和管理我的 OKR（目标与关键结果），以便 AI 分析我的工作是否在推进 OKR。

#### 验收标准

1. THE OKR_Page SHALL 以季度为单位展示 OKR 内容，默认显示当前季度，并提供季度切换功能（如 2025 Q1、2025 Q2）
2. THE OKR_Page SHALL 允许用户新增 Objective，每个 Objective 包含标题、描述和 Category 关联字段，用户从全局 Category 列表中选择一个分类
3. THE OKR_Page SHALL 允许用户在每个 Objective 下新增多条 Key_Result，每条 Key_Result 包含描述和完成状态字段
4. THE OKR_Page SHALL 允许用户编辑和删除已有的 Objective 和 Key_Result
5. WHEN 用户保存 OKR 数据, THE API_Server SHALL 将 Objective 和 Key_Result 持久化存储，Objective 记录包含字段：userId、quarter（如 "2025-Q1"）、title、description、categoryId、createdAt、updatedAt
6. THE API_Server SHALL 将 OKR 数据按用户隔离存储，每个用户维护独立的 OKR 数据
7. THE OKR_Page SHALL 以卡片式布局展示每个 Objective 及其下属 Key_Result，每个 Objective 卡片显示其关联的 Category 颜色标签，视觉风格与日杂设计一致
8. THE OKR_Page SHALL 不允许用户将 Objective 关联到"其他"分类，因为"其他"分类表示与 OKR 无关的事项

### 需求 12：灵感与待办

**用户故事：** 作为用户，我希望随手记录工作中的灵感和待办事项，并对其进行分类管理，以便不遗漏重要想法和任务。

#### 验收标准

1. THE Inspiration_Page SHALL 展示用户的所有 Inspiration_Entry 列表，支持按 Inspiration_Category 筛选
2. THE Inspiration_Page SHALL 允许用户快速新增 Inspiration_Entry，输入内容后选择类型（灵感或待办）和 Inspiration_Category
3. THE Inspiration_Page SHALL 允许用户新增、编辑和删除 Inspiration_Category
4. THE Calendar_App SHALL 提供默认的 Inspiration_Category 选项：工作、学习、项目、个人、其他
5. WHEN 用户将某条类型为"待办"的 Inspiration_Entry 标记为已完成, THE Inspiration_Page SHALL 更新该条目的完成状态并添加视觉区分（如删除线或淡化显示）
6. WHEN 用户保存 Inspiration_Entry, THE API_Server SHALL 将条目持久化存储，每条记录包含字段：userId、content、type（inspiration/todo）、categoryId、completed（仅待办类型）、createdAt、updatedAt
7. THE API_Server SHALL 将 Inspiration_Entry 数据按用户隔离存储
8. THE Inspiration_Page SHALL 支持按创建时间倒序排列条目，最新记录显示在最前面
