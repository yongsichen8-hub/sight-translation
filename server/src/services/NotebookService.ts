import { FileStorageService } from './FileStorageService';
import {
  NotebookProject,
  NotebookProjectInput,
  NotebooksFile,
  MemoContent,
  TiptapNode,
  AiSettings,
  OrganizedResult,
  BilingualExpression,
} from '../types';

/**
 * 笔记本服务 - 管理译前准备笔记本的 CRUD 操作
 */
export class NotebookService {
  constructor(private storage: FileStorageService) {}

  // ==================== 项目 CRUD ====================

  /**
   * 获取用户笔记本项目列表
   */
  async getNotebooks(userId: string): Promise<NotebookProject[]> {
    const data = await this.storage.readJson<NotebooksFile>(userId, 'notebooks.json');
    return data.notebooks;
  }

  /**
   * 按 ID 查找单个笔记本项目
   */
  async getNotebook(userId: string, id: string): Promise<NotebookProject | null> {
    const notebooks = await this.getNotebooks(userId);
    return notebooks.find(n => n.id === id) || null;
  }

  /**
   * 创建笔记本项目
   */
  async createNotebook(userId: string, input: NotebookProjectInput): Promise<NotebookProject> {
    if (!input.title || input.title.trim() === '') {
      throw new Error('VALIDATION_ERROR: 标题不能为空');
    }

    const data = await this.storage.readJson<NotebooksFile>(userId, 'notebooks.json');
    const now = new Date().toISOString();

    const notebook: NotebookProject = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      domain: input.domain?.trim() || '',
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: now,
      updatedAt: now,
    };

    data.notebooks.push(notebook);
    await this.storage.writeJson(userId, 'notebooks.json', data);
    return notebook;
  }

  /**
   * 更新笔记本项目
   */
  async updateNotebook(userId: string, id: string, updates: Partial<NotebookProjectInput>): Promise<void> {
    const data = await this.storage.readJson<NotebooksFile>(userId, 'notebooks.json');
    const index = data.notebooks.findIndex(n => n.id === id);

    if (index === -1) {
      throw new Error('NOT_FOUND: 笔记本项目不存在');
    }

    if (updates.title !== undefined && updates.title.trim() === '') {
      throw new Error('VALIDATION_ERROR: 标题不能为空');
    }

    data.notebooks[index] = {
      ...data.notebooks[index],
      ...(updates.title !== undefined && { title: updates.title.trim() }),
      ...(updates.domain !== undefined && { domain: updates.domain.trim() }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate }),
      id: data.notebooks[index].id,
      createdAt: data.notebooks[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.writeJson(userId, 'notebooks.json', data);
  }

  /**
   * 删除笔记本项目及关联的 memo 和 organized 文件
   */
  async deleteNotebook(userId: string, id: string): Promise<void> {
    const data = await this.storage.readJson<NotebooksFile>(userId, 'notebooks.json');
    const index = data.notebooks.findIndex(n => n.id === id);

    if (index === -1) {
      throw new Error('NOT_FOUND: 笔记本项目不存在');
    }

    data.notebooks.splice(index, 1);
    await this.storage.writeJson(userId, 'notebooks.json', data);

    // 级联删除关联文件
    await this.storage.deleteFile(userId, `notebook-${id}-memo.json`);
    await this.storage.deleteFile(userId, `notebook-${id}-organized.json`);
  }

  // ==================== 整理结果读取 ====================

  /**
   * 获取整理结果，文件不存在时返回 null
   */
  async getOrganizedResult(userId: string, notebookId: string): Promise<OrganizedResult | null> {
    const filename = `notebook-${notebookId}-organized.json`;
    const exists = await this.storage.exists(userId, filename);
    if (!exists) {
      return null;
    }
    return this.storage.readJson<OrganizedResult>(userId, filename);
  }

  // ==================== 备忘录读写 ====================

  /**
   * 获取备忘录内容，文件不存在时返回空文档
   */
  async getMemo(userId: string, notebookId: string): Promise<MemoContent> {
    const filename = `notebook-${notebookId}-memo.json`;
    const exists = await this.storage.exists(userId, filename);
    if (!exists) {
      return { type: 'doc', content: [] };
    }
    return this.storage.readJson<MemoContent>(userId, filename);
  }

  /**
   * 保存备忘录内容，内容大小不得超过 5MB
   */
  async saveMemo(userId: string, notebookId: string, content: MemoContent): Promise<void> {
    const serialized = JSON.stringify(content);
    const sizeInBytes = Buffer.byteLength(serialized, 'utf-8');
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (sizeInBytes > maxSize) {
      throw new Error('CONTENT_TOO_LARGE: 备忘录内容过大，请精简内容（上限 5MB）');
    }

    const filename = `notebook-${notebookId}-memo.json`;
    await this.storage.writeJson(userId, filename, content);
  }

  // ==================== AI 设置读写 ====================

  /**
   * 获取用户 AI 配置
   */
  async getAiSettings(userId: string): Promise<AiSettings> {
    return this.storage.readJson<AiSettings>(userId, 'notebook-ai-settings.json');
  }

  /**
   * 保存用户 AI 配置，所有字段不能为空
   */
  async saveAiSettings(userId: string, settings: AiSettings): Promise<void> {
    if (!settings.apiKey || settings.apiKey.trim() === '') {
      throw new Error('VALIDATION_ERROR: API Key 不能为空');
    }
    if (!settings.baseUrl || settings.baseUrl.trim() === '') {
      throw new Error('VALIDATION_ERROR: Base URL 不能为空');
    }
    if (!settings.model || settings.model.trim() === '') {
      throw new Error('VALIDATION_ERROR: 模型名称不能为空');
    }

    await this.storage.writeJson(userId, 'notebook-ai-settings.json', {
      apiKey: settings.apiKey.trim(),
      baseUrl: settings.baseUrl.trim(),
      model: settings.model.trim(),
    });
  }

  // ==================== AI 一键整理 ====================

  /**
   * 从 Tiptap JSON 内容中提取纯文本和 URL
   */
  private extractTextAndUrls(content: MemoContent): { text: string; urls: string[] } {
    const textParts: string[] = [];
    const urls: string[] = [];

    const walk = (nodes: TiptapNode[] | undefined): void => {
      if (!nodes) return;
      for (const node of nodes) {
        // Extract text from text nodes
        if (node.text) {
          textParts.push(node.text);
          // Check marks for link URLs
          if (node.marks) {
            for (const mark of node.marks) {
              if (mark.type === 'link' && mark.attrs?.href) {
                urls.push(mark.attrs.href as string);
              }
            }
          }
        }
        // Add line breaks between block-level nodes
        if (['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type)) {
          if (textParts.length > 0 && textParts[textParts.length - 1] !== '\n') {
            textParts.push('\n');
          }
        }
        // Recurse into children
        walk(node.content);
      }
    };

    walk(content.content);

    return {
      text: textParts.join('').trim(),
      urls: [...new Set(urls)],
    };
  }

  /**
   * AI 一键整理：读取备忘录内容，调用 OpenAI 兼容 API 整理为结构化 Markdown
   */
  async organizeNotes(userId: string, notebookId: string): Promise<OrganizedResult> {
    // 1. 读取用户 AI 配置
    const aiSettings = await this.getAiSettings(userId);
    if (!aiSettings.apiKey || !aiSettings.baseUrl || !aiSettings.model) {
      throw new Error('AI_NOT_CONFIGURED: 请先在设置中配置 AI 服务的 API Key、Base URL 和模型');
    }

    // 2. 读取备忘录内容
    const memo = await this.getMemo(userId, notebookId);
    if (!memo.content || memo.content.length === 0) {
      return {
        markdown: '备忘录为空，请先在左侧编辑器中添加笔记内容。',
        organizedAt: new Date().toISOString(),
      };
    }

    // 3. 提取纯文本和 URL
    const { text, urls } = this.extractTextAndUrls(memo);
    if (!text.trim()) {
      return {
        markdown: '备忘录为空，请先在左侧编辑器中添加笔记内容。',
        organizedAt: new Date().toISOString(),
      };
    }

    // 4. 构建 prompt
    const urlSection = urls.length > 0
      ? `\n\n笔记中包含的参考链接：\n${urls.map(u => `- ${u}`).join('\n')}`
      : '';

    const prompt = `你是一位专业的译前准备助手。请将以下零散的备忘录笔记整理为有逻辑、有条理的结构化内容。

要求：
1. 按主题进行分类归纳
2. 使用清晰的 Markdown 标题和层级结构
3. 保留原始内容中的事实依据和关键信息
4. 保留所有 URL 链接
5. 输出使用 Markdown 格式

备忘录内容：
${text}${urlSection}`;

    // 5. 调用 OpenAI 兼容 API（60 秒超时）
    const apiUrl = `${aiSettings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: aiSettings.model,
          messages: [
            { role: 'system', content: '你是一位专业的译前准备助手，擅长将零散笔记整理为结构化内容。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`AI_API_ERROR: AI 服务返回错误 (HTTP ${response.status})${errorBody ? ': ' + errorBody : ''}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const markdown = data.choices?.[0]?.message?.content?.trim() || '';
      if (!markdown) {
        throw new Error('AI_API_ERROR: AI 服务返回了空内容');
      }

      // 6. 存储整理结果
      const result: OrganizedResult = {
        markdown,
        organizedAt: new Date().toISOString(),
      };

      await this.storage.writeJson(userId, `notebook-${notebookId}-organized.json`, result);

      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('AI_TIMEOUT: AI 整理请求超时（60 秒），请稍后重试');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==================== 双语表达识别 ====================

  /**
   * 识别备忘录中的中英双语表达对
   */
  async extractBilingualExpressions(userId: string, notebookId: string): Promise<BilingualExpression[]> {
    // 1. 读取用户 AI 配置
    const aiSettings = await this.getAiSettings(userId);
    if (!aiSettings.apiKey || !aiSettings.baseUrl || !aiSettings.model) {
      throw new Error('AI_NOT_CONFIGURED: 请先在设置中配置 AI 服务的 API Key、Base URL 和模型');
    }

    // 2. 读取备忘录内容
    const memo = await this.getMemo(userId, notebookId);
    if (!memo.content || memo.content.length === 0) {
      return [];
    }

    // 3. 提取纯文本
    const { text } = this.extractTextAndUrls(memo);
    if (!text.trim()) {
      return [];
    }

    // 4. 构建 prompt
    const prompt = `你是一位专业的中英双语术语识别专家。请从以下文本中识别所有中英双语表达对（术语、短语、专有名词等）。

要求：
1. 识别文本中出现的中文表达及其对应的英文翻译（或反之）
2. 每对表达包含一个中文字段和一个英文字段
3. 仅返回 JSON 数组格式，不要包含其他文字说明
4. 如果没有识别到任何双语表达，返回空数组 []

输出格式示例：
[{"chinese": "人工智能", "english": "Artificial Intelligence"}, {"chinese": "机器学习", "english": "Machine Learning"}]

文本内容：
${text}`;

    // 5. 调用 OpenAI 兼容 API（60 秒超时）
    const apiUrl = `${aiSettings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: aiSettings.model,
          messages: [
            { role: 'system', content: '你是一位专业的中英双语术语识别专家。请严格按照 JSON 数组格式输出结果。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`AI_API_ERROR: AI 服务返回错误 (HTTP ${response.status})${errorBody ? ': ' + errorBody : ''}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim() || '';
      if (!content) {
        return [];
      }

      // 6. 解析 JSON 响应
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      const expressions: BilingualExpression[] = parsed
        .filter((item): item is { chinese: string; english: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).chinese === 'string' &&
          typeof (item as Record<string, unknown>).english === 'string'
        )
        .map(item => ({
          chinese: item.chinese,
          english: item.english,
        }));

      return expressions;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('AI_TIMEOUT: 双语表达识别请求超时（60 秒），请稍后重试');
      }
      // Re-throw JSON parse errors with a friendlier message
      if (err instanceof SyntaxError) {
        throw new Error('AI_API_ERROR: AI 返回的内容无法解析为有效的 JSON 格式');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
