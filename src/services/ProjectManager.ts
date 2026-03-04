/**
 * ProjectManager 服务
 * 管理项目的创建、读取和删除
 */

import { db } from '../db';
import { fileParser } from './FileParser';
import { paragraphSplitter } from './ParagraphSplitter';
import { createTextSeparator } from './TextSeparator';
import { createImageOCR } from './ImageOCR';
import type { Project, ProjectInput, OpenAIConfig, ParagraphPair } from '../types';
import { DuplicateError, ValidationError, DatabaseError } from '../types';

/**
 * 生成 UUID
 * 兼容不支持 crypto.randomUUID 的环境
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 回退方案：使用 crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  bytes[6]! = (bytes[6]! & 0x0f) | 0x40;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  bytes[8]! = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * ProjectManager 接口
 */
export interface IProjectManager {
  /**
   * 创建新项目
   * @param input 项目输入数据
   * @param openAIConfig OpenAI 配置（用于语义匹配）
   * @returns 创建的项目
   * @throws DuplicateError 当项目名已存在时
   * @throws ValidationError 当输入数据无效时
   */
  createProject(input: ProjectInput, openAIConfig?: OpenAIConfig): Promise<Project>;

  /**
   * 获取所有项目
   * @returns 项目列表
   */
  getProjects(): Promise<Project[]>;

  /**
   * 获取单个项目
   * @param id 项目ID
   * @returns 项目详情，不存在时返回 null
   */
  getProject(id: string): Promise<Project | null>;

  /**
   * 删除项目
   * @param id 项目ID
   */
  deleteProject(id: string): Promise<void>;
}

/**
 * ProjectManager 实现类
 */
export class ProjectManager implements IProjectManager {
  /**
   * 检查项目名是否已存在
   */
  private async isNameDuplicate(name: string): Promise<boolean> {
    const existing = await db.projects.where('name').equals(name).first();
    return existing !== undefined;
  }

  /**
   * 验证项目输入
   */
  private validateInput(input: ProjectInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('name', '请输入项目名称');
    }

    switch (input.mode) {
      case 'dual-file':
        if (!input.chineseFile) {
          throw new ValidationError('chineseFile', '请上传中文文件');
        }
        if (!input.englishFile) {
          throw new ValidationError('englishFile', '请上传英文文件');
        }
        break;
      case 'single-file':
        if (!input.file) {
          throw new ValidationError('file', '请上传文件');
        }
        break;
      case 'text':
        if (!input.text || input.text.trim().length === 0) {
          throw new ValidationError('text', '请输入文本内容');
        }
        break;
      case 'image':
        if (!input.images || input.images.length === 0) {
          throw new ValidationError('images', '请上传图片');
        }
        break;
    }
  }

  /**
   * 创建新项目
   */
  async createProject(input: ProjectInput, openAIConfig?: OpenAIConfig): Promise<Project> {
    this.validateInput(input);

    const trimmedName = input.name.trim();

    if (await this.isNameDuplicate(trimmedName)) {
      throw new DuplicateError('project', trimmedName);
    }

    try {
      let chineseText: string;
      let englishText: string;

      // 根据输入模式获取中英文文本
      switch (input.mode) {
        case 'dual-file':
          [chineseText, englishText] = await Promise.all([
            fileParser.parseFile(input.chineseFile),
            fileParser.parseFile(input.englishFile),
          ]);
          break;

        case 'single-file': {
          const fileText = await fileParser.parseFile(input.file);
          const separated = await this.separateText(fileText, openAIConfig);
          chineseText = separated.chinese;
          englishText = separated.english;
          break;
        }

        case 'text': {
          const separated = await this.separateText(input.text, openAIConfig);
          chineseText = separated.chinese;
          englishText = separated.english;
          break;
        }

        case 'image': {
          const ocrText = await this.processImages(input.images, openAIConfig);
          const separated = await this.separateText(ocrText, openAIConfig);
          chineseText = separated.chinese;
          englishText = separated.english;
          break;
        }
      }

      // 切分为段落：以中文为基准，英文强制切成相同数量，保证一一对应
      const { chinese: chineseParagraphs, english: englishParagraphs } =
        paragraphSplitter.splitAligned(chineseText, englishText);

      // 直接顺序配对（数量已对齐，无需 AI 匹配）
      const paragraphPairs = this.sequentialPair(chineseParagraphs, englishParagraphs);


      // 创建项目对象
      const now = new Date();
      const project: Project = {
        id: generateId(),
        name: trimmedName,
        createdAt: now,
        updatedAt: now,
        chineseText,
        englishText,
        chineseParagraphs,
        englishParagraphs,
        paragraphPairs,
      };

      await db.projects.add(project);
      return project;
    } catch (error) {
      if (error instanceof DuplicateError || error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'FileParseError') {
        throw error;
      }
      // 保留原始错误信息，便于调试
      if (error instanceof Error) {
        // 如果是 API 错误，直接抛出原始错误
        if (error.message.includes('API') || error.message.includes('fetch') || error.message.includes('Failed')) {
          throw error;
        }
        throw new DatabaseError('write', 'project', error);
      }
      throw new DatabaseError('write', 'project', undefined);
    }
  }

  /**
   * 分离中英文文本
   */
  private async separateText(
    text: string,
    openAIConfig?: OpenAIConfig
  ): Promise<{ chinese: string; english: string }> {
    if (openAIConfig?.apiKey) {
      const separator = createTextSeparator(openAIConfig);
      return separator.separate(text);
    }
    // 无 API Key 时使用本地检测
    return this.localSeparateText(text);
  }

  /**
   * 本地分离中英文（备用方案）
   */
  private localSeparateText(text: string): { chinese: string; english: string } {
    const paragraphs = text.split(/\n\n+/);
    const chinese: string[] = [];
    const english: string[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
      const ratio = chineseChars / trimmed.length;
      if (ratio > 0.3) {
        chinese.push(trimmed);
      } else {
        english.push(trimmed);
      }
    }

    return {
      chinese: chinese.join('\n\n'),
      english: english.join('\n\n'),
    };
  }

  /**
   * 处理图片 OCR
   */
  private async processImages(images: File[], openAIConfig?: OpenAIConfig): Promise<string> {
    if (!openAIConfig?.apiKey) {
      throw new ValidationError('apiKey', '图片识别需要 OpenAI API Key');
    }

    const ocr = createImageOCR(openAIConfig);
    const results: string[] = [];

    for (const image of images) {
      const text = await ocr.recognize(image);
      results.push(text);
    }

    return results.join('\n\n');
  }

  /**
   * 顺序配对段落（数量已对齐时直接使用）
   */
  private sequentialPair(chineseParagraphs: string[], englishParagraphs: string[]): ParagraphPair[] {
    const maxLen = Math.max(chineseParagraphs.length, englishParagraphs.length);
    const pairs: ParagraphPair[] = [];
    for (let i = 0; i < maxLen; i++) {
      const zh = chineseParagraphs[i] ?? '';
      const en = englishParagraphs[i] ?? '';
      if (zh || en) {
        pairs.push({ index: i, chinese: zh, english: en });
      }
    }
    return pairs;
  }

  /**
   * 更新项目的段落对（用于对齐编辑器保存）
   */
  async updateParagraphPairs(id: string, paragraphPairs: ParagraphPair[]): Promise<void> {
    try {
      await db.projects.update(id, {
        paragraphPairs,
        chineseParagraphs: paragraphPairs.map(p => p.chinese),
        englishParagraphs: paragraphPairs.map(p => p.english),
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new DatabaseError('write', 'project', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取所有项目
   * @returns 项目列表，按创建时间降序排列
   */
  async getProjects(): Promise<Project[]> {
    try {
      return await db.projects.orderBy('createdAt').reverse().toArray();
    } catch (error) {
      throw new DatabaseError(
        'read',
        'projects',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取单个项目
   * @param id 项目ID
   * @returns 项目详情，不存在时返回 null
   */
  async getProject(id: string): Promise<Project | null> {
    try {
      const project = await db.projects.get(id);
      return project ?? null;
    } catch (error) {
      throw new DatabaseError(
        'read',
        'project',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 删除项目
   * 同时级联删除关联的表达、Flashcard 和 ReviewRecord
   * @param id 项目ID
   */
  async deleteProject(id: string): Promise<void> {
    try {
      // 获取该项目关联的所有表达
      const expressions = await db.expressions.where('projectId').equals(id).toArray();
      const expressionIds = expressions.map((expr: { id: string }) => expr.id);

      // 删除关联的 Flashcard 和 ReviewRecord
      if (expressionIds.length > 0) {
        for (const expressionId of expressionIds) {
          // 查找关联的 Flashcard
          const flashcard = await db.flashcards.where('expressionId').equals(expressionId).first();
          if (flashcard) {
            // 删除关联的复习记录
            await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();
            // 删除 Flashcard
            await db.flashcards.delete(flashcard.id);
          }
        }
      }

      // 删除关联的表达
      await db.expressions.where('projectId').equals(id).delete();

      // 删除项目
      await db.projects.delete(id);
    } catch (error) {
      throw new DatabaseError(
        'delete',
        'project',
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * 默认 ProjectManager 实例
 */
export const projectManager = new ProjectManager();
