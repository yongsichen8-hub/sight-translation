import { apiClient } from './ApiClient';
import { db } from '../db';
import type { Project, Expression, Flashcard, ReviewRecord } from '../types';

// 重新导出类型供外部使用
export type { Project, Expression, Flashcard, ReviewRecord };

// 数据提供者接口 - 使用本地类型
export interface IDataProvider {
  // 项目
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // 表达
  getExpressions(keyword?: string): Promise<Expression[]>;
  createExpression(input: Omit<Expression, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expression>;
  updateExpression(id: string, updates: Partial<Expression>): Promise<void>;
  deleteExpression(id: string): Promise<void>;

  // 闪卡
  getFlashcards(): Promise<Flashcard[]>;
  getDueFlashcards(): Promise<Flashcard[]>;
  recordReview(flashcardId: string, remembered: boolean): Promise<void>;
}

/**
 * 本地数据提供者 - 使用 IndexedDB (Dexie)
 */
export class LocalDataProvider implements IDataProvider {
  async getProjects(): Promise<Project[]> {
    return db.projects.toArray();
  }

  async getProject(id: string): Promise<Project | null> {
    const project = await db.projects.get(id);
    return project || null;
  }

  async createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const project: Project = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.projects.add(project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const project = await db.projects.get(id);
    if (project) {
      await db.projects.put({
        ...project,
        ...updates,
        id,
        updatedAt: new Date(),
      });
    }
  }

  async deleteProject(id: string): Promise<void> {
    await db.projects.delete(id);
  }

  async getExpressions(keyword?: string): Promise<Expression[]> {
    const expressions = await db.expressions.toArray();
    if (!keyword) return expressions;
    
    const lower = keyword.toLowerCase();
    return expressions.filter(e =>
      e.chinese.toLowerCase().includes(lower) ||
      e.english.toLowerCase().includes(lower) ||
      e.notes.toLowerCase().includes(lower)
    );
  }

  async createExpression(input: Omit<Expression, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expression> {
    const now = new Date();
    const expression: Expression = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.expressions.add(expression);
    return expression;
  }

  async updateExpression(id: string, updates: Partial<Expression>): Promise<void> {
    const expression = await db.expressions.get(id);
    if (expression) {
      await db.expressions.put({
        ...expression,
        ...updates,
        id,
        updatedAt: new Date(),
      });
    }
  }

  async deleteExpression(id: string): Promise<void> {
    await db.expressions.delete(id);
  }

  async getFlashcards(): Promise<Flashcard[]> {
    return db.flashcards.toArray();
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    const flashcards = await this.getFlashcards();
    const now = new Date();
    return flashcards.filter(f => f.nextReviewDate <= now);
  }

  async recordReview(flashcardId: string, remembered: boolean): Promise<void> {
    const flashcard = await db.flashcards.get(flashcardId);
    if (!flashcard) return;

    const now = new Date();
    let newInterval: number;

    if (remembered) {
      newInterval = Math.min(flashcard.currentInterval * 2, 30);
    } else {
      newInterval = 1;
    }

    const nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

    await db.flashcards.put({
      ...flashcard,
      currentInterval: newInterval,
      nextReviewDate: nextReviewDate,
      reviewCount: flashcard.reviewCount + 1,
      lastReviewDate: now,
    });

    // 记录复习历史
    await db.reviewRecords.add({
      id: crypto.randomUUID(),
      flashcardId,
      reviewedAt: now,
      remembered,
    });
  }
}

/**
 * 远程数据提供者 - 使用 API
 * 注意：API 返回的日期是字符串格式，需要转换
 */
export class RemoteDataProvider implements IDataProvider {
  private parseDate(dateStr: string): Date {
    return new Date(dateStr);
  }

  private parseProject(p: Record<string, unknown>): Project {
    return {
      ...p,
      createdAt: this.parseDate(p.createdAt as string),
      updatedAt: this.parseDate(p.updatedAt as string),
    } as Project;
  }

  private parseExpression(e: Record<string, unknown>): Expression {
    return {
      ...e,
      createdAt: this.parseDate(e.createdAt as string),
      updatedAt: this.parseDate(e.updatedAt as string),
    } as Expression;
  }

  private parseFlashcard(f: Record<string, unknown>): Flashcard {
    return {
      ...f,
      nextReviewDate: this.parseDate(f.nextReviewDate as string),
      lastReviewDate: f.lastReviewDate ? this.parseDate(f.lastReviewDate as string) : null,
      createdAt: this.parseDate(f.createdAt as string),
    } as Flashcard;
  }

  async getProjects(): Promise<Project[]> {
    const projects = await apiClient.getProjects();
    return projects.map(p => this.parseProject(p as unknown as Record<string, unknown>));
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const project = await apiClient.getProject(id);
      return this.parseProject(project as unknown as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const project = await apiClient.createProject(input as Parameters<typeof apiClient.createProject>[0]);
    return this.parseProject(project as unknown as Record<string, unknown>);
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    await apiClient.updateProject(id, updates as unknown as Parameters<typeof apiClient.updateProject>[1]);
  }

  async deleteProject(id: string): Promise<void> {
    await apiClient.deleteProject(id);
  }

  async getExpressions(keyword?: string): Promise<Expression[]> {
    const expressions = await apiClient.getExpressions(keyword);
    return expressions.map(e => this.parseExpression(e as unknown as Record<string, unknown>));
  }

  async createExpression(input: Omit<Expression, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expression> {
    const expression = await apiClient.createExpression(input as Parameters<typeof apiClient.createExpression>[0]);
    return this.parseExpression(expression as unknown as Record<string, unknown>);
  }

  async updateExpression(id: string, updates: Partial<Expression>): Promise<void> {
    await apiClient.updateExpression(id, updates as unknown as Parameters<typeof apiClient.updateExpression>[1]);
  }

  async deleteExpression(id: string): Promise<void> {
    await apiClient.deleteExpression(id);
  }

  async getFlashcards(): Promise<Flashcard[]> {
    const flashcards = await apiClient.getFlashcards();
    return flashcards.map(f => this.parseFlashcard(f as unknown as Record<string, unknown>));
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    const flashcards = await apiClient.getDueFlashcards();
    return flashcards.map(f => this.parseFlashcard(f as unknown as Record<string, unknown>));
  }

  async recordReview(flashcardId: string, remembered: boolean): Promise<void> {
    await apiClient.recordReview(flashcardId, remembered);
  }
}

// 单例实例
const localProvider = new LocalDataProvider();
const remoteProvider = new RemoteDataProvider();

/**
 * 获取数据提供者
 * @param isAuthenticated 是否已登录
 */
export function getDataProvider(isAuthenticated: boolean): IDataProvider {
  return isAuthenticated ? remoteProvider : localProvider;
}
