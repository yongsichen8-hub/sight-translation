# 需求文档：练习进度记忆

## 简介

为视译练习平台增加"练习进度记忆"功能。用户退出某个项目的练习后，再次进入该项目时，系统自动恢复到上次停留的滚动位置，无需手动拖动进度条。

当前 PracticeView 组件在退出时不保存任何滚动位置信息，每次进入项目都从顶部开始。本功能将在项目数据中持久化滚动进度，并在进入练习时自动恢复。

## 术语表

- **Practice_View**：练习视图组件，包含中英文双栏内容区，用户在此进行视译练习
- **Scroll_Position**：滚动位置，指练习视图内容区的垂直滚动偏移量（像素值）
- **Scroll_Percentage**：滚动百分比，指滚动位置占内容总高度的比例（0 到 1 之间的小数），用于在内容高度变化时仍能准确恢复位置
- **Progress_Data**：进度数据，包含 Scroll_Percentage 和记录时间的结构化数据
- **Project**：练习项目，包含中英文双语文本的练习单元
- **DataService**：前端数据服务层，根据登录状态自动切换本地 IndexedDB 和远程 API
- **FileStorageService**：后端文件存储服务，管理用户数据的 JSON 文件持久化

## 需求

### 需求 1：退出练习时保存滚动进度

**用户故事：** 作为一名视译练习者，我希望退出项目练习时系统自动保存我的阅读位置，以便下次继续练习时不用重新寻找上次的位置。

#### 验收标准

1. WHEN 用户点击"退出"按钮离开 Practice_View，THE Practice_View SHALL 将当前内容区的 Scroll_Percentage 作为 Progress_Data 保存到对应 Project 中
2. WHEN 用户从编辑模式切换到练习模式后再退出，THE Practice_View SHALL 保存练习模式下的 Scroll_Percentage
3. THE Practice_View SHALL 使用 Scroll_Percentage（而非像素值）记录进度，以确保在不同屏幕尺寸或内容变化后仍能准确恢复位置
4. IF 保存 Progress_Data 失败，THEN THE Practice_View SHALL 静默处理错误，不阻断用户退出操作

### 需求 2：进入练习时恢复滚动进度

**用户故事：** 作为一名视译练习者，我希望再次进入某个项目时自动跳转到上次停留的位置，以便无缝继续练习。

#### 验收标准

1. WHEN 用户进入一个已有 Progress_Data 的 Project 的 Practice_View，THE Practice_View SHALL 在内容渲染完成后自动将内容区滚动到保存的 Scroll_Percentage 对应的位置
2. WHEN 用户进入一个没有 Progress_Data 的 Project 的 Practice_View，THE Practice_View SHALL 从内容顶部开始显示
3. THE Practice_View SHALL 在恢复滚动位置时同步左右两栏的滚动，使中英文内容保持对齐
4. IF 恢复 Scroll_Percentage 对应的位置超出当前内容范围（例如内容被删减），THEN THE Practice_View SHALL 滚动到内容末尾

### 需求 3：进度数据持久化

**用户故事：** 作为一名使用飞书登录的用户，我希望练习进度能同步到云端，以便在不同设备上继续练习。

#### 验收标准

1. THE DataService SHALL 通过现有的 Project 更新接口持久化 Progress_Data
2. WHEN 用户已登录，THE DataService SHALL 将 Progress_Data 通过 API 同步到后端 FileStorageService
3. WHEN 用户未登录，THE DataService SHALL 将 Progress_Data 保存到本地 IndexedDB
4. THE Progress_Data SHALL 包含 Scroll_Percentage 和最后更新时间戳两个字段
5. THE FileStorageService SHALL 将 Progress_Data 作为 Project 数据的一部分存储在 projects.json 中，无需创建额外的存储文件
