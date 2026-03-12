# 需求文档：Notebook（译前准备笔记本）

## 简介

Notebook 是视译练习应用中的一个新功能模块，旨在帮助用户在译前准备阶段整理零散的笔记内容。用户可以创建不同的准备项目，在富文本备忘录中自由记录文字、URL、图片等内容，并通过 AI 一键整理功能将零散笔记归纳为有逻辑、有条理的结构化内容。此外，系统能够识别笔记中的中英双语表达并导出为 Excel 表格。

## 术语表

- **Notebook_System**：笔记本功能模块的整体系统，包含前端界面和后端服务
- **Notebook_Project**：用户创建的笔记本项目，包含标题、时间周期、领域等基本信息
- **Memo_Editor**：页面左侧的富文本备忘录编辑器，支持文字、URL、图片等内容的自由记录
- **Organizer**：AI 一键整理引擎，负责将零散笔记归纳为结构化内容
- **Organized_View**：页面右侧的整理结果展示区域
- **Exporter**：导出模块，负责识别中英双语表达并生成 Excel 文件
- **Rich_Text_Content**：备忘录中的富文本内容，包含文字、格式标注、URL 和图片

## 需求

### 需求 1：笔记本项目管理

**用户故事：** 作为一名译员，我想要创建和管理不同的译前准备项目，以便为每次翻译任务独立组织准备材料。

#### 验收标准

1. WHEN 用户点击"新建项目"按钮，THE Notebook_System SHALL 显示项目创建表单，包含标题、时间周期（开始日期和结束日期）、领域三个字段
2. WHEN 用户填写完项目信息并提交，THE Notebook_System SHALL 创建一个新的 Notebook_Project 并将其持久化存储到服务端
3. WHEN 用户提交项目创建表单时标题字段为空，THE Notebook_System SHALL 阻止提交并在标题字段旁显示"标题不能为空"的错误提示
4. THE Notebook_System SHALL 在笔记本首页以列表形式展示当前用户的所有 Notebook_Project，每个项目显示标题、领域和创建时间
5. WHEN 用户点击某个 Notebook_Project，THE Notebook_System SHALL 导航到该项目的工作区页面
6. WHEN 用户点击项目的删除按钮并确认删除，THE Notebook_System SHALL 删除该 Notebook_Project 及其关联的所有备忘录内容和整理结果
7. WHEN 用户点击项目的编辑按钮，THE Notebook_System SHALL 允许用户修改项目的标题、时间周期和领域信息

### 需求 2：富文本备忘录编辑

**用户故事：** 作为一名译员，我想要在备忘录中自由记录各种格式的笔记内容，以便在译前准备过程中快速记录零散信息。

#### 验收标准

1. THE Memo_Editor SHALL 在项目工作区页面的左侧区域显示，占据页面宽度的约 40%
2. THE Memo_Editor SHALL 支持用户输入和编辑纯文本内容
3. THE Memo_Editor SHALL 支持用户粘贴或输入 URL 链接，并将 URL 渲染为可点击的超链接
4. THE Memo_Editor SHALL 支持用户粘贴或上传图片，并在编辑器中内联显示图片
5. THE Memo_Editor SHALL 提供工具栏，包含以下格式化选项：标题（H1、H2、H3）、加粗、斜体、下划线、文字颜色
6. WHEN 用户选中文本并点击格式化按钮，THE Memo_Editor SHALL 将选中文本应用对应的格式样式
7. WHEN 用户编辑备忘录内容，THE Memo_Editor SHALL 在用户停止输入 2 秒后自动保存内容到服务端
8. IF 自动保存失败，THEN THE Memo_Editor SHALL 在编辑器顶部显示"保存失败，请检查网络连接"的提示，并在 10 秒后自动重试保存

### 需求 3：AI 一键整理

**用户故事：** 作为一名译员，我想要将零散的备忘录笔记一键整理为有逻辑、有条理的结构化内容，以便高效地完成译前准备。

#### 验收标准

1. THE Notebook_System SHALL 在项目工作区页面的中间区域显示"一键整理"按钮
2. WHEN 用户点击"一键整理"按钮，THE Organizer SHALL 读取当前项目 Memo_Editor 中的全部 Rich_Text_Content
3. WHEN Organizer 处理笔记内容时，THE Notebook_System SHALL 在"一键整理"按钮位置显示加载动画，并禁用该按钮
4. WHEN Organizer 完成整理，THE Organized_View SHALL 在页面右侧区域展示整理后的结构化内容，包含清晰的分类标题和层级结构
5. THE Organizer SHALL 将零散笔记按主题进行分类归纳，保留原始内容中的事实依据和关键信息
6. THE Organizer SHALL 在整理结果中保留原始笔记中的 URL 链接，使其在 Organized_View 中可点击访问
7. IF Organizer 整理过程中发生错误，THEN THE Notebook_System SHALL 在页面中间区域显示错误提示信息，并允许用户重新点击"一键整理"按钮重试
8. WHEN 用户修改左侧备忘录内容后再次点击"一键整理"，THE Organizer SHALL 基于最新的备忘录内容重新生成整理结果，并替换 Organized_View 中的旧内容

### 需求 4：中英双语表达导出

**用户故事：** 作为一名译员，我想要将备忘录中的中英双语表达导出为 Excel 表格，以便在翻译过程中快速查阅术语对照。

#### 验收标准

1. THE Notebook_System SHALL 在项目工作区页面提供"导出双语表达"按钮
2. WHEN 用户点击"导出双语表达"按钮，THE Exporter SHALL 扫描当前项目 Memo_Editor 中的全部 Rich_Text_Content，识别其中的中英双语表达对
3. THE Exporter SHALL 将识别到的双语表达整理为表格形式，包含"中文"和"英文"两列
4. WHEN Exporter 完成识别和整理，THE Notebook_System SHALL 自动触发浏览器下载一个 Excel 文件（.xlsx 格式），文件名格式为"{项目标题}_双语表达_{日期}.xlsx"
5. IF Exporter 未在备忘录内容中识别到任何中英双语表达，THEN THE Notebook_System SHALL 显示提示"未识别到中英双语表达，请确认备忘录中包含中英文内容"
6. WHEN 导出过程中发生错误，THE Notebook_System SHALL 显示错误提示信息，并允许用户重试导出

### 需求 5：数据持久化与用户隔离

**用户故事：** 作为一名已登录用户，我想要我的笔记本数据安全存储在服务端，并且与其他用户的数据隔离，以便在不同设备上访问我的笔记。

#### 验收标准

1. THE Notebook_System SHALL 使用现有的 FileStorageService 将每个用户的笔记本数据存储为独立的 JSON 文件
2. THE Notebook_System SHALL 将 Notebook_Project 列表存储在用户目录下的 notebooks.json 文件中
3. THE Notebook_System SHALL 将每个项目的备忘录内容和整理结果分别存储，避免单个文件过大
4. WHILE 用户未登录，THE Notebook_System SHALL 禁止访问笔记本功能，并提示用户先登录
5. THE Notebook_System SHALL 确保每个用户只能访问和操作属于该用户的笔记本数据
