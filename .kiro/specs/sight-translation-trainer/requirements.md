# Requirements Document

## Introduction

视译练习软件（Sight Translation Trainer）是一款帮助译员练习视译技能的工具。软件支持中英双语文本的项目管理、视译练习、表达收藏、术语库管理以及基于艾宾浩斯记忆曲线的Flashcard复习功能。

## Glossary

- **Project**: 包含同一文本的中英双语版本的练习单元
- **Sentence_Splitter**: 自动将文本切分为独立句子的组件
- **Translation_Viewer**: 显示和隐藏对应翻译的界面组件
- **Expression_Collector**: 收藏和管理用户选中表达的组件
- **Glossary_Manager**: 管理术语库的组件
- **Flashcard_Generator**: 基于艾宾浩斯记忆曲线生成复习卡片的组件
- **Practice_Mode**: 视译练习模式，包括中译英和英译中两种

## Requirements

### Requirement 1: Project Management

**User Story:** As a translator, I want to create and manage translation projects with bilingual texts, so that I can organize my practice materials.

#### Acceptance Criteria

1. THE Project SHALL allow users to create a new project with a unique name
2. WHEN creating a project, THE Project SHALL require uploading both Chinese and English text files
3. THE Project SHALL support uploading files in TXT, PDF, and Word (.doc, .docx) formats
4. THE Project SHALL extract text content from PDF and Word files automatically
5. THE Project SHALL validate that both uploaded files contain text content
4. IF a file upload fails, THEN THE Project SHALL display an error message indicating the failure reason
5. THE Project SHALL allow users to view a list of all created projects
6. THE Project SHALL allow users to delete an existing project
7. WHEN a project is deleted, THE Expression_Collector SHALL remove all associated saved expressions

### Requirement 2: Text Sentence Splitting

**User Story:** As a translator, I want the text to be automatically split into sentences, so that I can practice translation sentence by sentence.

#### Acceptance Criteria

1. WHEN a text file is loaded, THE Sentence_Splitter SHALL split the text into individual sentences
2. THE Sentence_Splitter SHALL display each sentence on a separate line
3. THE Sentence_Splitter SHALL preserve the original sentence order
4. THE Sentence_Splitter SHALL handle common sentence-ending punctuation for both Chinese (。！？) and English (. ! ?)
5. IF a sentence cannot be properly split, THEN THE Sentence_Splitter SHALL keep the original text segment intact

### Requirement 3: Sight Translation Practice Mode

**User Story:** As a translator, I want to practice sight translation in both Chinese-to-English and English-to-Chinese directions, so that I can improve my bidirectional translation skills.

#### Acceptance Criteria

1. THE Practice_Mode SHALL provide two options: Chinese-to-English and English-to-Chinese
2. WHEN Chinese-to-English mode is selected, THE Translation_Viewer SHALL display Chinese text with a "Show English" button for each sentence
3. WHEN English-to-Chinese mode is selected, THE Translation_Viewer SHALL display English text with a "Show Chinese" button for each sentence
4. WHEN a "Show Translation" button is clicked, THE Translation_Viewer SHALL display the corresponding translation next to the source sentence
5. THE Translation_Viewer SHALL allow hiding a displayed translation by clicking the button again
6. THE Translation_Viewer SHALL maintain the alignment between source sentences and their translations

### Requirement 4: Expression Collection

**User Story:** As a translator, I want to save useful expressions from translations, so that I can build my personal expression library.

#### Acceptance Criteria

1. WHILE a translation is displayed, THE Expression_Collector SHALL allow users to select text by highlighting
2. WHEN text is selected, THE Expression_Collector SHALL display a "Save Expression" option
3. WHEN saving an expression, THE Expression_Collector SHALL store both the selected text and its context sentence
4. THE Expression_Collector SHALL record the source language and target language of the saved expression
5. IF the same expression is saved twice, THEN THE Expression_Collector SHALL notify the user and prevent duplicate entries
6. THE Expression_Collector SHALL allow users to add notes to saved expressions

### Requirement 5: Glossary Management

**User Story:** As a translator, I want to manage and browse my saved expressions, so that I can review and organize my terminology.

#### Acceptance Criteria

1. THE Glossary_Manager SHALL display all saved expressions in a list view
2. THE Glossary_Manager SHALL allow filtering expressions by source language
3. THE Glossary_Manager SHALL allow searching expressions by keyword
4. THE Glossary_Manager SHALL allow users to edit notes on saved expressions
5. THE Glossary_Manager SHALL allow users to delete saved expressions
6. WHEN an expression is deleted, THE Flashcard_Generator SHALL remove it from the review schedule

### Requirement 6: Flashcard Review System

**User Story:** As a translator, I want to review saved expressions using flashcards based on spaced repetition, so that I can memorize expressions effectively.

#### Acceptance Criteria

1. THE Flashcard_Generator SHALL generate review cards from saved expressions
2. THE Flashcard_Generator SHALL schedule reviews based on the Ebbinghaus forgetting curve intervals (1 day, 2 days, 4 days, 7 days, 15 days, 30 days)
3. WHEN a flashcard is displayed, THE Flashcard_Generator SHALL show the source expression first
4. WHEN the user requests, THE Flashcard_Generator SHALL reveal the target translation
5. THE Flashcard_Generator SHALL allow users to mark their recall as "Remembered" or "Forgot"
6. WHEN "Remembered" is selected, THE Flashcard_Generator SHALL advance the expression to the next review interval
7. WHEN "Forgot" is selected, THE Flashcard_Generator SHALL reset the expression to the first review interval
8. THE Flashcard_Generator SHALL display the count of cards due for review today
9. IF no cards are due for review, THEN THE Flashcard_Generator SHALL display a message indicating no reviews are scheduled

### Requirement 7: Data Persistence

**User Story:** As a translator, I want my projects and saved expressions to be preserved, so that I can continue my practice across sessions.

#### Acceptance Criteria

1. THE Project SHALL persist all project data to local storage
2. THE Expression_Collector SHALL persist all saved expressions to local storage
3. THE Flashcard_Generator SHALL persist review schedules and progress to local storage
4. WHEN the application starts, THE Project SHALL load all previously saved projects
5. IF data loading fails, THEN THE Project SHALL display an error message and offer to start with empty data
