/**
 * 统一数据服务层
 * 根据登录状态自动选择本地 IndexedDB 或远程 API 存储
 */

import { apiClient } from './ApiClient';
import { db } from '../db';
import type { Project, Expression, Flashcard, ReviewRecord, ProjectInput, OpenAIConfig, ParagraphPair } from '../types';
import { fileParser } from './FileParser';
import { paragraphSplitter } from './ParagraphSplitter';
import { createTextSeparator } from './TextSeparator';
import { createImageOCR } from './ImageOCR';
import { DuplicateError, ValidationError, DatabaseError } from '../types';

/**
 * 生成 UUID - 兼容不支持 crypto.randomUUID 的环境
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
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
 * 获取今天的日期（不含时间部分）
 */
function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// 当前登录状态
let _isAuthenticated = false;

/**
 * 设置认证状态
 */
export function setAuthState(authenticated: boolean): void {
  _isAuthenticated = authenticated;
}

/**
 * 获取认证状态
 */
export function isAuthenticated(): boolean {
  return _isAuthenticated;
}

// ==================== 项目服务 ====================

/**
 * 获取所有项目
 */
export async function getProjects(): Promise<Project[]> {
  if (_isAuthenticated) {
    try {
      const projects = await apiClient.getProjects();
      return projects.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        practiceProgress: p.practiceProgress ? { ...p.practiceProgress, updatedAt: new Date(p.practiceProgress.updatedAt) } : undefined,
        checkedInAt: p.checkedInAt ? new Date(p.checkedInAt) : undefined,
      })) as Project[];
    } catch (error) {
      console.error('Failed to get projects from API:', error);
      throw error;
    }
  }
  return db.projects.orderBy('createdAt').reverse().toArray();
}

/**
 * 获取单个项目
 */
export async function getProject(id: string): Promise<Project | null> {
  if (_isAuthenticated) {
    try {
      const project = await apiClient.getProject(id);
      return {
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        practiceProgress: project.practiceProgress ? { ...project.practiceProgress, updatedAt: new Date(project.practiceProgress.updatedAt) } : undefined,
        checkedInAt: project.checkedInAt ? new Date(project.checkedInAt) : undefined,
      } as Project;
    } catch {
      return null;
    }
  }
  const project = await db.projects.get(id);
  return project ?? null;
}


/**
 * 创建项目（包含文件解析逻辑）
 */
export async function createProject(input: ProjectInput, openAIConfig?: OpenAIConfig): Promise<Project> {
  // 验证输入
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('name', '请输入项目名称');
  }

  const trimmedName = input.name.trim();

  // 检查重复（本地模式）
  if (!_isAuthenticated) {
    const existing = await db.projects.where('name').equals(trimmedName).first();
    if (existing) {
      throw new DuplicateError('project', trimmedName);
    }
  }

  try {
    let chineseText: string;
    let englishText: string;

    // 根据输入模式获取中英文文本
    switch (input.mode) {
      case 'dual-file':
        if (!input.chineseFile || !input.englishFile) {
          throw new ValidationError('file', '请上传中英文文件');
        }
        [chineseText, englishText] = await Promise.all([
          fileParser.parseFile(input.chineseFile),
          fileParser.parseFile(input.englishFile),
        ]);
        break;

      case 'single-file': {
        if (!input.file) {
          throw new ValidationError('file', '请上传文件');
        }
        const fileText = await fileParser.parseFile(input.file);
        const separated = await separateText(fileText, openAIConfig);
        chineseText = separated.chinese;
        englishText = separated.english;
        break;
      }

      case 'text': {
        if (!input.text || input.text.trim().length === 0) {
          throw new ValidationError('text', '请输入文本内容');
        }
        const separated = await separateText(input.text, openAIConfig);
        chineseText = separated.chinese;
        englishText = separated.english;
        break;
      }

      case 'image': {
        if (!input.images || input.images.length === 0) {
          throw new ValidationError('images', '请上传图片');
        }
        const ocrText = await processImages(input.images, openAIConfig);
        const separated = await separateText(ocrText, openAIConfig);
        chineseText = separated.chinese;
        englishText = separated.english;
        break;
      }

      default:
        throw new ValidationError('mode', '无效的输入模式');
    }

    // 切分为段落
    const { chinese: chineseParagraphs, english: englishParagraphs } =
      paragraphSplitter.splitAligned(chineseText, englishText);

    // 顺序配对
    const paragraphPairs = sequentialPair(chineseParagraphs, englishParagraphs);

    const now = new Date();
    const projectData = {
      name: trimmedName,
      chineseText,
      englishText,
      chineseParagraphs,
      englishParagraphs,
      paragraphPairs,
    };

    if (_isAuthenticated) {
      // 远程创建
      const created = await apiClient.createProject(projectData as Parameters<typeof apiClient.createProject>[0]);
      return {
        ...created,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
        practiceProgress: created.practiceProgress ? { ...created.practiceProgress, updatedAt: new Date(created.practiceProgress.updatedAt) } : undefined,
      } as Project;
    }

    // 本地创建
    const project: Project = {
      id: generateId(),
      ...projectData,
      createdAt: now,
      updatedAt: now,
    };
    await db.projects.add(project);
    return project;
  } catch (error) {
    if (error instanceof DuplicateError || error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.message.includes('API') || error.message.includes('fetch') || error.message.includes('Failed')) {
        throw error;
      }
      throw new DatabaseError('write', 'project', error);
    }
    throw new DatabaseError('write', 'project', undefined);
  }
}

/**
 * 更新项目段落对
 */
export async function updateProjectParagraphs(id: string, paragraphPairs: ParagraphPair[]): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.updateProject(id, {
      paragraphPairs,
      chineseParagraphs: paragraphPairs.map(p => p.chinese),
      englishParagraphs: paragraphPairs.map(p => p.english),
    } as Parameters<typeof apiClient.updateProject>[1]);
    return;
  }
  await db.projects.update(id, {
    paragraphPairs,
    chineseParagraphs: paragraphPairs.map(p => p.chinese),
    englishParagraphs: paragraphPairs.map(p => p.english),
    updatedAt: new Date(),
  });
}

/**
 * 更新项目练习进度
 */
export async function updateProjectProgress(
  id: string,
  progress: { scrollPercentage: number; practiceTimeSeconds?: number; updatedAt: string }
): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.updateProject(id, { practiceProgress: progress } as Parameters<typeof apiClient.updateProject>[1]);
    return;
  }
  await db.projects.update(id, {
    practiceProgress: {
      scrollPercentage: progress.scrollPercentage,
      ...(progress.practiceTimeSeconds !== undefined && { practiceTimeSeconds: progress.practiceTimeSeconds }),
      updatedAt: new Date(progress.updatedAt),
    },
    updatedAt: new Date(),
  });
}

/**
 * 删除项目
 */
export async function deleteProject(id: string): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.deleteProject(id);
    return;
  }

  // 本地删除：级联删除关联数据
  const expressions = await db.expressions.where('projectId').equals(id).toArray();
  for (const expr of expressions) {
    const flashcard = await db.flashcards.where('expressionId').equals(expr.id).first();
    if (flashcard) {
      await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();
      await db.flashcards.delete(flashcard.id);
    }
  }
  await db.expressions.where('projectId').equals(id).delete();
  await db.projects.delete(id);
}

/**
 * 打卡项目
 */
export async function checkInProject(id: string): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.checkInProject(id);
    return;
  }
  // 本地模式：直接更新 IndexedDB
  await db.projects.update(id, {
    checkedIn: true,
    checkedInAt: new Date(),
    updatedAt: new Date(),
  });
}

// 辅助函数
async function separateText(text: string, openAIConfig?: OpenAIConfig): Promise<{ chinese: string; english: string }> {
  if (openAIConfig?.apiKey) {
    const separator = createTextSeparator(openAIConfig);
    return separator.separate(text);
  }
  return localSeparateText(text);
}

function localSeparateText(text: string): { chinese: string; english: string } {
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
  return { chinese: chinese.join('\n\n'), english: english.join('\n\n') };
}

async function processImages(images: File[], openAIConfig?: OpenAIConfig): Promise<string> {
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

function sequentialPair(chineseParagraphs: string[], englishParagraphs: string[]): ParagraphPair[] {
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


// ==================== 表达/术语服务 ====================

export interface ExpressionInput {
  projectId: string;
  chinese: string;
  english: string;
  notes?: string | undefined;
}

/**
 * 获取所有表达
 */
export async function getExpressions(keyword?: string): Promise<Expression[]> {
  if (_isAuthenticated) {
    const expressions = await apiClient.getExpressions(keyword);
    return expressions.map(e => ({
      ...e,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    })) as Expression[];
  }

  let expressions = await db.expressions.toArray();
  
  // 兼容旧数据格式
  expressions = expressions.map((expr) => {
    const oldExpr = expr as Expression & { text?: string; sourceLanguage?: string };
    if (oldExpr.text && !expr.chinese && !expr.english) {
      const isChinese = oldExpr.sourceLanguage === 'zh';
      return {
        ...expr,
        chinese: isChinese ? oldExpr.text : '',
        english: isChinese ? '' : oldExpr.text,
        notes: expr.notes || '',
      };
    }
    return {
      ...expr,
      chinese: expr.chinese || '',
      english: expr.english || '',
      notes: expr.notes || '',
    };
  });

  if (keyword) {
    const kw = keyword.toLowerCase();
    expressions = expressions.filter(
      (expr) =>
        (expr.chinese || '').toLowerCase().includes(kw) ||
        (expr.english || '').toLowerCase().includes(kw) ||
        (expr.notes || '').toLowerCase().includes(kw)
    );
  }

  expressions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return expressions;
}

/**
 * 保存表达（自动创建闪卡）
 */
export async function saveExpression(input: ExpressionInput): Promise<Expression> {
  if (!input.chinese || input.chinese.trim().length === 0) {
    throw new ValidationError('chinese', '请输入中文术语');
  }
  if (!input.english || input.english.trim().length === 0) {
    throw new ValidationError('english', '请输入英文术语');
  }

  const chinese = input.chinese.trim();
  const english = input.english.trim();

  if (_isAuthenticated) {
    const created = await apiClient.createExpression({
      projectId: input.projectId,
      chinese,
      english,
      notes: input.notes?.trim() || '',
    });
    return {
      ...created,
      createdAt: new Date(created.createdAt),
      updatedAt: new Date(created.updatedAt),
    } as Expression;
  }

  // 本地：检查重复
  const existing = await db.expressions
    .filter(e => e.chinese === chinese && e.english === english)
    .first();
  if (existing) {
    throw new DuplicateError('expression', `${chinese} / ${english}`);
  }

  const now = new Date();
  const expression: Expression = {
    id: generateId(),
    projectId: input.projectId.trim(),
    chinese,
    english,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };
  await db.expressions.add(expression);

  // 自动创建闪卡
  const flashcard: Flashcard = {
    id: generateId(),
    expressionId: expression.id,
    currentInterval: 0,
    nextReviewDate: getToday(),
    reviewCount: 0,
    lastReviewDate: null,
    createdAt: now,
  };
  await db.flashcards.add(flashcard);

  return expression;
}

/**
 * 更新表达
 */
export async function updateExpression(
  id: string,
  updates: Partial<Pick<Expression, 'chinese' | 'english' | 'notes'>>
): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.updateExpression(id, updates as Parameters<typeof apiClient.updateExpression>[1]);
    return;
  }

  const expression = await db.expressions.get(id);
  if (!expression) {
    throw new ValidationError('id', '术语不存在');
  }

  const updateData: Partial<Expression> = { updatedAt: new Date() };
  if (updates.chinese !== undefined) updateData.chinese = updates.chinese.trim();
  if (updates.english !== undefined) updateData.english = updates.english.trim();
  if (updates.notes !== undefined) updateData.notes = updates.notes.trim();

  await db.expressions.update(id, updateData);
}

/**
 * 删除表达
 */
export async function deleteExpression(id: string): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.deleteExpression(id);
    return;
  }

  // 本地：级联删除闪卡和复习记录
  const flashcard = await db.flashcards.where('expressionId').equals(id).first();
  if (flashcard) {
    await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();
    await db.flashcards.delete(flashcard.id);
  }
  await db.expressions.delete(id);
}

/**
 * 批量删除表达
 */
export async function deleteExpressionsBatch(ids: string[]): Promise<number> {
  if (_isAuthenticated) {
    const result = await apiClient.deleteExpressionsBatch(ids);
    return result.deleted;
  }

  // 本地：逐个删除（含级联）
  let deleted = 0;
  for (const id of ids) {
    try {
      await deleteExpression(id);
      deleted++;
    } catch { /* skip not found */ }
  }
  return deleted;
}

/**
 * 导入表达（用于 Excel 导入，不需要 projectId）
 */
export async function importExpression(data: { chinese: string; english: string; notes?: string }): Promise<Expression> {
  return saveExpression({
    projectId: '__imported__',
    chinese: data.chinese,
    english: data.english,
    notes: data.notes ?? undefined,
  });
}


// ==================== 闪卡服务 ====================

/**
 * 获取所有闪卡
 */
export async function getFlashcards(): Promise<Flashcard[]> {
  if (_isAuthenticated) {
    const flashcards = await apiClient.getFlashcards();
    return flashcards.map(f => ({
      ...f,
      nextReviewDate: new Date(f.nextReviewDate),
      lastReviewDate: f.lastReviewDate ? new Date(f.lastReviewDate) : null,
      createdAt: new Date(f.createdAt),
    })) as Flashcard[];
  }
  return db.flashcards.toArray();
}

/**
 * 获取待复习的闪卡
 */
export async function getDueFlashcards(): Promise<Flashcard[]> {
  if (_isAuthenticated) {
    const flashcards = await apiClient.getDueFlashcards();
    return flashcards.map(f => ({
      ...f,
      nextReviewDate: new Date(f.nextReviewDate),
      lastReviewDate: f.lastReviewDate ? new Date(f.lastReviewDate) : null,
      createdAt: new Date(f.createdAt),
    })) as Flashcard[];
  }

  const today = getToday();
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return db.flashcards.where('nextReviewDate').below(endOfToday).toArray();
}

/**
 * 获取待复习数量
 */
export async function getDueCount(): Promise<number> {
  const dueCards = await getDueFlashcards();
  return dueCards.length;
}

/**
 * 记录复习结果
 */
export async function recordReview(flashcardId: string, remembered: boolean): Promise<void> {
  if (_isAuthenticated) {
    await apiClient.recordReview(flashcardId, remembered);
    return;
  }

  const flashcard = await db.flashcards.get(flashcardId);
  if (!flashcard) {
    throw new ValidationError('flashcardId', '闪卡不存在');
  }

  const now = new Date();
  const today = getToday();
  let newInterval: number;
  let newNextReviewDate: Date;

  // 艾宾浩斯记忆曲线间隔（天）
  const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30];

  if (remembered) {
    newInterval = Math.min(flashcard.currentInterval + 1, REVIEW_INTERVALS.length - 1);
    const daysToAdd = REVIEW_INTERVALS[newInterval] ?? REVIEW_INTERVALS[0]!;
    newNextReviewDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  } else {
    newInterval = 0;
    newNextReviewDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // 明天
  }

  await db.flashcards.update(flashcardId, {
    currentInterval: newInterval,
    nextReviewDate: newNextReviewDate,
    reviewCount: flashcard.reviewCount + 1,
    lastReviewDate: now,
  });

  // 创建复习记录
  const reviewRecord: ReviewRecord = {
    id: generateId(),
    flashcardId,
    reviewedAt: now,
    remembered,
  };
  await db.reviewRecords.add(reviewRecord);
}

/**
 * 为表达创建复习计划
 */
export async function scheduleExpression(expressionId: string): Promise<void> {
  if (_isAuthenticated) {
    // 远程模式下，创建表达时已自动创建闪卡
    return;
  }

  const expression = await db.expressions.get(expressionId);
  if (!expression) {
    throw new ValidationError('expressionId', '表达不存在');
  }

  const existing = await db.flashcards.where('expressionId').equals(expressionId).first();
  if (existing) {
    return; // 已存在
  }

  const flashcard: Flashcard = {
    id: generateId(),
    expressionId,
    currentInterval: 0,
    nextReviewDate: getToday(),
    reviewCount: 0,
    lastReviewDate: null,
    createdAt: new Date(),
  };
  await db.flashcards.add(flashcard);
}

/**
 * 移除表达的复习计划
 */
export async function removeSchedule(expressionId: string): Promise<void> {
  if (_isAuthenticated) {
    // 远程模式下，删除表达时会自动删除闪卡
    return;
  }

  const flashcard = await db.flashcards.where('expressionId').equals(expressionId).first();
  if (flashcard) {
    await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();
    await db.flashcards.delete(flashcard.id);
  }
}

// 导出默认实例（兼容旧代码）
export const dataService = {
  // 项目
  getProjects,
  getProject,
  createProject,
  updateProjectParagraphs,
  updateProjectProgress,
  deleteProject,
  checkInProject,
  // 表达
  getExpressions,
  saveExpression,
  updateExpression,
  deleteExpression,
  deleteExpressionsBatch,
  importExpression,
  // 闪卡
  getFlashcards,
  getDueFlashcards,
  getDueCount,
  recordReview,
  scheduleExpression,
  removeSchedule,
  // 状态
  setAuthState,
  isAuthenticated,
};

export default dataService;
