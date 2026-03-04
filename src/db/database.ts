/**
 * IndexedDB 数据库配置
 * 使用 Dexie.js 实现本地数据持久化
 */

import Dexie, { type Table } from 'dexie';
import type { Project, Expression, Flashcard, ReviewRecord } from '../types';

/**
 * 视译练习数据库
 * 包含项目、表达、Flashcard 和复习记录四个表
 */
export class SightTranslationDB extends Dexie {
  /** 项目表 */
  projects!: Table<Project>;
  /** 表达表 */
  expressions!: Table<Expression>;
  /** Flashcard 表 */
  flashcards!: Table<Flashcard>;
  /** 复习记录表 */
  reviewRecords!: Table<ReviewRecord>;

  constructor() {
    super('SightTranslationDB');
    
    // 定义数据库版本和表结构
    // 索引格式: 'primaryKey, index1, index2, ...'
    this.version(1).stores({
      // 项目表: id 为主键，name 和 createdAt 为索引
      projects: 'id, name, createdAt',
      // 表达表: id 为主键，projectId、sourceLanguage、text、createdAt 为索引
      expressions: 'id, projectId, sourceLanguage, text, createdAt',
      // Flashcard 表: id 为主键，expressionId 和 nextReviewDate 为索引
      flashcards: 'id, expressionId, nextReviewDate',
      // 复习记录表: id 为主键，flashcardId 和 reviewedAt 为索引
      reviewRecords: 'id, flashcardId, reviewedAt',
    });

    // 版本 2: 更新 Expression 模型，使用 chinese/english 替代 text/sourceLanguage
    this.version(2).stores({
      projects: 'id, name, createdAt',
      expressions: 'id, projectId, chinese, english, createdAt',
      flashcards: 'id, expressionId, nextReviewDate',
      reviewRecords: 'id, flashcardId, reviewedAt',
    });
  }
}

/** 数据库单例实例 */
export const db = new SightTranslationDB();

/**
 * 初始化数据库
 * 确保数据库已打开并可用
 * @returns Promise<void>
 */
export async function initializeDatabase(): Promise<void> {
  await db.open();
}

/**
 * 清空数据库（用于测试）
 * @returns Promise<void>
 */
export async function clearDatabase(): Promise<void> {
  await db.projects.clear();
  await db.expressions.clear();
  await db.flashcards.clear();
  await db.reviewRecords.clear();
}

/**
 * 删除数据库（用于测试或重置）
 * @returns Promise<void>
 */
export async function deleteDatabase(): Promise<void> {
  await db.delete();
}
