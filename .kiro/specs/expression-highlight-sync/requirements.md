# 需求文档

## 简介

在 Sight Translation Trainer（视译训练工具）中，用户在练习视图中划线收藏英文或中文表达后，被收藏的文本片段在原文中以浅黄色高亮显示。高亮状态需要持久化存储，并通过云端同步，确保用户在不同设备上看到一致的高亮效果。

## 术语表

- **Practice_View**：练习视图组件，左右双栏显示中英文原文，用户可在此划词收藏表达
- **Expression**：用户收藏的中英文术语对，包含 chinese、english、projectId 等字段
- **Highlight**：原文中对已收藏表达文本的浅黄色视觉标记
- **Data_Service**：前端统一数据服务层，根据登录状态自动切换本地 IndexedDB 和远程 API 存储
- **FileStorageService**：后端基于 JSON 文件的数据持久化服务
- **SaveExpressionPopup**：划词后弹出的术语保存弹窗组件

## 需求

### 需求 1：收藏表达后在原文中高亮显示

**用户故事：** 作为视译练习用户，我希望收藏表达后能在原文中看到浅黄色高亮，以便快速识别已收藏的术语。

#### 验收标准

1. WHEN 用户通过 SaveExpressionPopup 成功保存一个表达, THE Practice_View SHALL 立即在对应的原文文本中以浅黄色（#FFF9C4）背景高亮显示该表达的文本片段
2. THE Practice_View SHALL 对当前项目中所有已收藏的 Expression 在原文中进行高亮渲染
3. WHEN 用户进入练习模式查看某个项目, THE Practice_View SHALL 加载该项目关联的所有 Expression 并在原文中渲染对应的高亮
4. WHEN 原文中同一文本片段被多个 Expression 覆盖, THE Practice_View SHALL 仅显示一层浅黄色高亮而非叠加颜色

### 需求 2：高亮文本的精确匹配与渲染

**用户故事：** 作为视译练习用户，我希望高亮能准确标记我收藏的文本，不会出现错位或遗漏。

#### 验收标准

1. THE Practice_View SHALL 使用 Expression 中存储的 chinese 字段值在中文栏原文中进行子字符串匹配来定位高亮位置
2. THE Practice_View SHALL 使用 Expression 中存储的 english 字段值在英文栏原文中进行子字符串匹配来定位高亮位置
3. WHEN Expression 的 chinese 或 english 字段值在原文中出现多次, THE Practice_View SHALL 对所有匹配位置均进行高亮显示
4. WHEN Expression 的 chinese 或 english 字段值在原文中未找到匹配, THE Practice_View SHALL 跳过该 Expression 的高亮渲染且不显示错误信息

### 需求 3：高亮状态的持久化存储

**用户故事：** 作为视译练习用户，我希望高亮状态在刷新页面或重新打开应用后仍然保留。

#### 验收标准

1. THE Data_Service SHALL 在保存 Expression 时同时持久化该 Expression 的高亮关联信息（projectId、chinese、english 字段）
2. WHEN 用户删除一个 Expression, THE Practice_View SHALL 移除原文中对应的高亮显示
3. WHEN 用户在未登录状态下收藏表达, THE Data_Service SHALL 将 Expression 数据存储到本地 IndexedDB 中，页面刷新后高亮状态可从本地数据恢复

### 需求 4：高亮状态的云端同步

**用户故事：** 作为已登录用户，我希望高亮状态能同步到云端，在不同设备上看到一致的高亮效果。

#### 验收标准

1. WHEN 已登录用户保存一个 Expression, THE Data_Service SHALL 通过 API 将 Expression 数据同步到后端 FileStorageService
2. WHEN 已登录用户在另一台设备打开同一项目, THE Practice_View SHALL 从云端加载该项目的所有 Expression 并渲染对应的高亮
3. WHEN 已登录用户删除一个 Expression, THE Data_Service SHALL 通过 API 将删除操作同步到后端，其他设备刷新后高亮随之消失
4. IF 云端同步请求失败, THEN THE Data_Service SHALL 向用户显示错误提示信息

### 需求 5：编辑模式与高亮的交互

**用户故事：** 作为视译练习用户，我希望在编辑模式和练习模式之间切换时，高亮行为符合预期。

#### 验收标准

1. WHILE Practice_View 处于编辑模式, THE Practice_View SHALL 不显示高亮标记（编辑模式使用 textarea，不支持富文本高亮）
2. WHEN 用户从编辑模式切换到练习模式, THE Practice_View SHALL 重新渲染所有已收藏 Expression 的高亮
