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
   * 从 Tiptap JSON 内容中提取纯文本、URL 和图片
   */
  private extractTextAndUrls(content: MemoContent): { text: string; urls: string[]; imageUrls: string[] } {
    const textParts: string[] = [];
    const urls: string[] = [];
    const imageUrls: string[] = [];

    const walk = (nodes: TiptapNode[] | undefined): void => {
      if (!nodes) return;
      for (const node of nodes) {
        // Extract image src
        if (node.type === 'image' && node.attrs?.src) {
          const src = node.attrs.src as string;
          imageUrls.push(src);
          // 用编号占位符代替完整图片数据，避免 base64 撑爆 token
          textParts.push(`\n[图片${imageUrls.length}]\n`);
        }
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
      imageUrls,
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
    const { text, urls, imageUrls } = this.extractTextAndUrls(memo);
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
5. 如果原始笔记比较零碎，请适当补充过渡性语句和连接词，使内容阅读起来更加丝滑、连贯
6. 补充的内容应基于笔记中已有的信息进行合理衔接，不要凭空编造新事实
7. 笔记是按时间顺序书写的。如果同一事实前后出现了不同的数值或描述（如人数、金额、日期等），以后出现的（即文本中靠后的）为准，整理结果中只保留最新数据
8. 文本中的 [图片1]、[图片2] 等标记代表用户插入的图片，请在整理结果中原样保留这些占位符（如 [图片1]），放在相关内容附近，不要修改占位符格式
9. 输出使用 Markdown 格式

备忘录内容：
${text}${urlSection}`;

    // 5. 调用 OpenAI 兼容 API（120 秒超时）
    const apiUrl = `${aiSettings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

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

      // 6. 将图片占位符替换回 Markdown 图片语法
      // AI 可能改变占位符格式（加空格、改括号等），用宽松正则匹配
      // 不把 base64 嵌入 markdown，而是用 placeholder:// 协议引用，前端渲染时替换为真实数据
      let finalMarkdown = markdown;
      for (let i = 0; i < imageUrls.length; i++) {
        const idx = i + 1;
        // 宽松匹配：[图片1]、【图片1】、[图片 1]、[ 图片1 ] 等变体
        const regex = new RegExp(`(?<!!)[\\[【]\\s*图片\\s*${idx}\\s*[\\]】]`, 'g');
        finalMarkdown = finalMarkdown.replace(regex, `![图片${idx}](placeholder://${idx})`);
      }

      // 7. 存储整理结果（markdown 只含 placeholder:// 引用，不含 base64，保持文件小）
      const result: OrganizedResult = {
        markdown: finalMarkdown,
        organizedAt: new Date().toISOString(),
      };

      await this.storage.writeJson(userId, `notebook-${notebookId}-organized.json`, result);

      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('AI_TIMEOUT: AI 整理请求超时（120 秒），请稍后重试');
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

    // 校验 Base URL 格式
    const baseUrlLower = aiSettings.baseUrl.toLowerCase();
    if (baseUrlLower.includes('platform.deepseek.com')) {
      throw new Error('AI_CONFIG_ERROR: Base URL 填写了 DeepSeek 管理页面地址，请改为 https://api.deepseek.com/v1');
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
    const prompt = `你是一位专业的中英双语术语识别专家。请从以下文本中识别所有中英双语表达对。

识别规则：
1. 只提取符合"中文-英文"或"英文-中文"格式的表达对，即用短横线（-）连接的中英对照
2. 典型格式为：用引号包裹的"中文-English"，例如"西门子-Siemens AG"、"一个科技公司战略-One Tech Company"
3. 短语、术语、专有名词、公司名、品牌名等都算
4. 不要自行翻译或猜测配对，只提取文本中已经明确标注了中英对照的表达
5. 仅返回 JSON 数组格式，不要包含其他文字说明
6. 如果没有识别到任何双语表达，返回空数组 []

输出格式示例：
[{"chinese": "西门子", "english": "Siemens AG"}, {"chinese": "一个科技公司战略", "english": "One Tech Company"}]

文本内容：
${text}`;

    // 5. 调用 OpenAI 兼容 API（120 秒超时）
    const apiUrl = `${aiSettings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

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
        throw new Error('AI_TIMEOUT: 双语表达识别请求超时（120 秒），请稍后重试');
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
