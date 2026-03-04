import { v4 as uuidv4 } from 'uuid';
import { fileStorageService } from './FileStorageService';
import {
  User,
  Project,
  ProjectInput,
  ProjectsFile,
  Expression,
  ExpressionInput,
  ExpressionsFile,
  Flashcard,
  FlashcardsFile,
  ReviewRecord,
  ReviewRecordInput,
  ReviewRecordsFile,
  FeishuUserInfo,
} from '../types';

/**
 * 数据服务 - 管理用户数据的 CRUD 操作
 */
export class DataService {
  // ==================== 用户管理 ====================

  /**
   * 获取用户信息
   */
  async getUser(userId: string): Promise<User | null> {
    return fileStorageService.readJson<User | null>(userId, 'user.json');
  }

  /**
   * 创建新用户
   */
  async createUser(feishuUser: FeishuUserInfo): Promise<User> {
    const userId = feishuUser.union_id || feishuUser.open_id;
    const now = new Date().toISOString();

    const user: User = {
      id: uuidv4(),
      feishuUserId: userId,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url,
      createdAt: now,
      updatedAt: now,
    };

    await fileStorageService.ensureUserDir(userId);
    await fileStorageService.writeJson(userId, 'user.json', user);
    return user;
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('NOT_FOUND: 用户不存在');
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      id: user.id, // 不允许修改 ID
      feishuUserId: user.feishuUserId, // 不允许修改飞书 ID
      createdAt: user.createdAt, // 不允许修改创建时间
      updatedAt: new Date().toISOString(),
    };

    await fileStorageService.writeJson(userId, 'user.json', updatedUser);
  }


  // ==================== 项目管理 ====================

  /**
   * 获取用户项目列表
   */
  async getProjects(userId: string): Promise<Project[]> {
    const data = await fileStorageService.readJson<ProjectsFile>(userId, 'projects.json');
    return data.projects;
  }

  /**
   * 获取单个项目
   */
  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const projects = await this.getProjects(userId);
    return projects.find(p => p.id === projectId) || null;
  }

  /**
   * 创建项目
   */
  async createProject(userId: string, input: ProjectInput): Promise<Project> {
    const data = await fileStorageService.readJson<ProjectsFile>(userId, 'projects.json');
    const now = new Date().toISOString();

    const project: Project = {
      id: uuidv4(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    data.projects.push(project);
    await fileStorageService.writeJson(userId, 'projects.json', data);
    return project;
  }

  /**
   * 更新项目
   */
  async updateProject(userId: string, projectId: string, updates: Partial<Project>): Promise<void> {
    const data = await fileStorageService.readJson<ProjectsFile>(userId, 'projects.json');
    const index = data.projects.findIndex(p => p.id === projectId);

    if (index === -1) {
      throw new Error('NOT_FOUND: 项目不存在');
    }

    data.projects[index] = {
      ...data.projects[index],
      ...updates,
      id: data.projects[index].id, // 不允许修改 ID
      createdAt: data.projects[index].createdAt, // 不允许修改创建时间
      updatedAt: new Date().toISOString(),
    };

    await fileStorageService.writeJson(userId, 'projects.json', data);
  }

  /**
   * 删除项目
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const data = await fileStorageService.readJson<ProjectsFile>(userId, 'projects.json');
    const index = data.projects.findIndex(p => p.id === projectId);

    if (index === -1) {
      throw new Error('NOT_FOUND: 项目不存在');
    }

    data.projects.splice(index, 1);
    await fileStorageService.writeJson(userId, 'projects.json', data);

    // 级联删除相关表达
    await this.deleteExpressionsByProject(userId, projectId);
  }

  /**
   * 删除项目相关的表达
   */
  private async deleteExpressionsByProject(userId: string, projectId: string): Promise<void> {
    const expressionsData = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    const expressionIds = expressionsData.expressions
      .filter(e => e.projectId === projectId)
      .map(e => e.id);

    expressionsData.expressions = expressionsData.expressions.filter(e => e.projectId !== projectId);
    await fileStorageService.writeJson(userId, 'expressions.json', expressionsData);

    // 级联删除相关闪卡
    for (const expressionId of expressionIds) {
      await this.deleteFlashcardsByExpression(userId, expressionId);
    }
  }


  // ==================== 表达管理 ====================

  /**
   * 获取表达列表
   */
  async getExpressions(userId: string, keyword?: string): Promise<Expression[]> {
    const data = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    
    if (!keyword) {
      return data.expressions;
    }

    const lowerKeyword = keyword.toLowerCase();
    return data.expressions.filter(e =>
      e.chinese.toLowerCase().includes(lowerKeyword) ||
      e.english.toLowerCase().includes(lowerKeyword) ||
      e.notes.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 获取单个表达
   */
  async getExpression(userId: string, expressionId: string): Promise<Expression | null> {
    const expressions = await this.getExpressions(userId);
    return expressions.find(e => e.id === expressionId) || null;
  }

  /**
   * 创建表达
   */
  async createExpression(userId: string, input: ExpressionInput): Promise<Expression> {
    const data = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    const now = new Date().toISOString();

    const expression: Expression = {
      id: uuidv4(),
      projectId: input.projectId,
      chinese: input.chinese,
      english: input.english,
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    data.expressions.push(expression);
    await fileStorageService.writeJson(userId, 'expressions.json', data);

    // 自动创建闪卡
    await this.createFlashcardForExpression(userId, expression.id);

    return expression;
  }

  /**
   * 更新表达
   */
  async updateExpression(userId: string, expressionId: string, updates: Partial<Expression>): Promise<void> {
    const data = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    const index = data.expressions.findIndex(e => e.id === expressionId);

    if (index === -1) {
      throw new Error('NOT_FOUND: 表达不存在');
    }

    data.expressions[index] = {
      ...data.expressions[index],
      ...updates,
      id: data.expressions[index].id,
      projectId: data.expressions[index].projectId,
      createdAt: data.expressions[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    await fileStorageService.writeJson(userId, 'expressions.json', data);
  }

  /**
   * 删除表达
   */
  async deleteExpression(userId: string, expressionId: string): Promise<void> {
    const data = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    const index = data.expressions.findIndex(e => e.id === expressionId);

    if (index === -1) {
      throw new Error('NOT_FOUND: 表达不存在');
    }

    data.expressions.splice(index, 1);
    await fileStorageService.writeJson(userId, 'expressions.json', data);

    // 级联删除相关闪卡
    await this.deleteFlashcardsByExpression(userId, expressionId);
  }


  // ==================== 闪卡管理 ====================

  /**
   * 获取所有闪卡
   */
  async getFlashcards(userId: string): Promise<Flashcard[]> {
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    return data.flashcards;
  }

  /**
   * 获取待复习闪卡
   */
  async getDueFlashcards(userId: string): Promise<Flashcard[]> {
    const flashcards = await this.getFlashcards(userId);
    const now = new Date().toISOString();
    return flashcards.filter(f => f.nextReviewDate <= now);
  }

  /**
   * 为表达创建闪卡
   */
  private async createFlashcardForExpression(userId: string, expressionId: string): Promise<Flashcard> {
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    const now = new Date().toISOString();

    const flashcard: Flashcard = {
      id: uuidv4(),
      expressionId,
      currentInterval: 1,
      nextReviewDate: now, // 立即可复习
      reviewCount: 0,
      lastReviewDate: null,
      createdAt: now,
    };

    data.flashcards.push(flashcard);
    await fileStorageService.writeJson(userId, 'flashcards.json', data);
    return flashcard;
  }

  /**
   * 更新闪卡
   */
  async updateFlashcard(userId: string, flashcardId: string, updates: Partial<Flashcard>): Promise<void> {
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    const index = data.flashcards.findIndex(f => f.id === flashcardId);

    if (index === -1) {
      throw new Error('NOT_FOUND: 闪卡不存在');
    }

    data.flashcards[index] = {
      ...data.flashcards[index],
      ...updates,
      id: data.flashcards[index].id,
      expressionId: data.flashcards[index].expressionId,
      createdAt: data.flashcards[index].createdAt,
    };

    await fileStorageService.writeJson(userId, 'flashcards.json', data);
  }

  /**
   * 删除表达相关的闪卡
   */
  private async deleteFlashcardsByExpression(userId: string, expressionId: string): Promise<void> {
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    const flashcardIds = data.flashcards
      .filter(f => f.expressionId === expressionId)
      .map(f => f.id);

    data.flashcards = data.flashcards.filter(f => f.expressionId !== expressionId);
    await fileStorageService.writeJson(userId, 'flashcards.json', data);

    // 删除相关复习记录
    for (const flashcardId of flashcardIds) {
      await this.deleteReviewRecordsByFlashcard(userId, flashcardId);
    }
  }

  /**
   * 记录复习结果
   */
  async recordReview(userId: string, flashcardId: string, remembered: boolean): Promise<void> {
    // 创建复习记录
    await this.createReviewRecord(userId, { flashcardId, remembered });

    // 更新闪卡状态
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    const flashcard = data.flashcards.find(f => f.id === flashcardId);

    if (!flashcard) {
      throw new Error('NOT_FOUND: 闪卡不存在');
    }

    const now = new Date();
    let newInterval: number;

    if (remembered) {
      // 记住了，增加间隔（简单的间隔重复算法）
      newInterval = Math.min(flashcard.currentInterval * 2, 30); // 最大 30 天
    } else {
      // 忘记了，重置间隔
      newInterval = 1;
    }

    const nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

    await this.updateFlashcard(userId, flashcardId, {
      currentInterval: newInterval,
      nextReviewDate: nextReviewDate.toISOString(),
      reviewCount: flashcard.reviewCount + 1,
      lastReviewDate: now.toISOString(),
    });
  }


  // ==================== 复习记录管理 ====================

  /**
   * 创建复习记录
   */
  async createReviewRecord(userId: string, input: ReviewRecordInput): Promise<ReviewRecord> {
    const data = await fileStorageService.readJson<ReviewRecordsFile>(userId, 'review-records.json');

    const record: ReviewRecord = {
      id: uuidv4(),
      flashcardId: input.flashcardId,
      reviewedAt: new Date().toISOString(),
      remembered: input.remembered,
    };

    data.records.push(record);
    await fileStorageService.writeJson(userId, 'review-records.json', data);
    return record;
  }

  /**
   * 获取闪卡的复习记录
   */
  async getReviewRecords(userId: string, flashcardId: string): Promise<ReviewRecord[]> {
    const data = await fileStorageService.readJson<ReviewRecordsFile>(userId, 'review-records.json');
    return data.records.filter(r => r.flashcardId === flashcardId);
  }

  /**
   * 删除闪卡相关的复习记录
   */
  private async deleteReviewRecordsByFlashcard(userId: string, flashcardId: string): Promise<void> {
    const data = await fileStorageService.readJson<ReviewRecordsFile>(userId, 'review-records.json');
    data.records = data.records.filter(r => r.flashcardId !== flashcardId);
    await fileStorageService.writeJson(userId, 'review-records.json', data);
  }

  // ==================== 批量导入（用于数据迁移） ====================

  /**
   * 批量导入项目
   */
  async importProjects(userId: string, projects: Project[]): Promise<number> {
    const data = await fileStorageService.readJson<ProjectsFile>(userId, 'projects.json');
    data.projects.push(...projects);
    await fileStorageService.writeJson(userId, 'projects.json', data);
    return projects.length;
  }

  /**
   * 批量导入表达
   */
  async importExpressions(userId: string, expressions: Expression[]): Promise<number> {
    const data = await fileStorageService.readJson<ExpressionsFile>(userId, 'expressions.json');
    data.expressions.push(...expressions);
    await fileStorageService.writeJson(userId, 'expressions.json', data);
    return expressions.length;
  }

  /**
   * 批量导入闪卡
   */
  async importFlashcards(userId: string, flashcards: Flashcard[]): Promise<number> {
    const data = await fileStorageService.readJson<FlashcardsFile>(userId, 'flashcards.json');
    data.flashcards.push(...flashcards);
    await fileStorageService.writeJson(userId, 'flashcards.json', data);
    return flashcards.length;
  }

  /**
   * 批量导入复习记录
   */
  async importReviewRecords(userId: string, records: ReviewRecord[]): Promise<number> {
    const data = await fileStorageService.readJson<ReviewRecordsFile>(userId, 'review-records.json');
    data.records.push(...records);
    await fileStorageService.writeJson(userId, 'review-records.json', data);
    return records.length;
  }
}

// 导出单例
export const dataService = new DataService();
