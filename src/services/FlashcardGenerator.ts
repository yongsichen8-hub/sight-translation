/**
 * FlashcardGenerator 服务
 * 基于艾宾浩斯记忆曲线生成和管理复习卡片
 */

import { db } from '../db';
import type { Flashcard, ReviewRecord } from '../types';
import { REVIEW_INTERVALS, DatabaseError, ValidationError } from '../types';

/**
 * 生成 UUID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 获取今天的日期（不含时间部分）
 */
function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 获取明天的日期
 */
function getTomorrow(): Date {
  const today = getToday();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * 计算下次复习日期
 * @param intervalIndex 间隔索引 (0-5)
 * @returns 下次复习日期
 */
function calculateNextReviewDate(intervalIndex: number): Date {
  const today = getToday();
  const clampedIndex = Math.min(Math.max(intervalIndex, 0), REVIEW_INTERVALS.length - 1);
  const daysToAdd = REVIEW_INTERVALS[clampedIndex] ?? REVIEW_INTERVALS[0]!;
  return new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

/**
 * FlashcardGenerator 接口
 */
export interface IFlashcardGenerator {
  /**
   * 获取今日待复习的卡片
   * @returns 待复习卡片列表
   */
  getDueCards(): Promise<Flashcard[]>;

  /**
   * 获取今日待复习卡片数量
   * @returns 卡片数量
   */
  getDueCount(): Promise<number>;

  /**
   * 记录复习结果
   * @param cardId 卡片ID
   * @param remembered 是否记住
   */
  recordReview(cardId: string, remembered: boolean): Promise<void>;

  /**
   * 为新表达创建复习计划
   * @param expressionId 表达ID
   */
  scheduleExpression(expressionId: string): Promise<void>;

  /**
   * 移除表达的复习计划
   * @param expressionId 表达ID
   */
  removeSchedule(expressionId: string): Promise<void>;
}

/**
 * FlashcardGenerator 实现类
 */
export class FlashcardGenerator implements IFlashcardGenerator {
  /**
   * 为新表达创建复习计划
   * 新表达的 nextReviewDate 设为明天，currentInterval 为 0
   * @param expressionId 表达ID
   */
  async scheduleExpression(expressionId: string): Promise<void> {
    if (!expressionId || expressionId.trim().length === 0) {
      throw new ValidationError('expressionId', 'Expression ID is required');
    }

    try {
      // 检查表达是否存在
      const expression = await db.expressions.get(expressionId);
      if (!expression) {
        throw new ValidationError('expressionId', 'Expression not found');
      }

      // 检查是否已有复习计划
      const existingFlashcard = await db.flashcards
        .where('expressionId')
        .equals(expressionId)
        .first();

      if (existingFlashcard) {
        // 已存在复习计划，不重复创建
        return;
      }

      // 创建新的 Flashcard
      const flashcard: Flashcard = {
        id: generateId(),
        expressionId: expressionId.trim(),
        currentInterval: 0,
        nextReviewDate: getToday(), // 立即可以复习
        reviewCount: 0,
        lastReviewDate: null,
        createdAt: new Date(),
      };

      await db.flashcards.add(flashcard);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError(
        'write',
        'flashcard',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取今日待复习的卡片
   * 返回 nextReviewDate <= 今天 的所有卡片
   * @returns 待复习卡片列表
   */
  async getDueCards(): Promise<Flashcard[]> {
    try {
      const today = getToday();
      // 获取今天结束时间（明天0点）
      const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // 查询 nextReviewDate <= 今天 的卡片
      const dueCards = await db.flashcards
        .where('nextReviewDate')
        .below(endOfToday)
        .toArray();

      return dueCards;
    } catch (error) {
      throw new DatabaseError(
        'read',
        'flashcards',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取今日待复习卡片数量
   * @returns 卡片数量
   */
  async getDueCount(): Promise<number> {
    try {
      const dueCards = await this.getDueCards();
      return dueCards.length;
    } catch (error) {
      throw new DatabaseError(
        'read',
        'flashcards',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 记录复习结果
   * - "记住"时：currentInterval + 1，nextReviewDate = today + REVIEW_INTERVALS[currentInterval]
   * - "忘记"时：currentInterval 重置为 0，nextReviewDate = 明天
   * @param cardId 卡片ID
   * @param remembered 是否记住
   */
  async recordReview(cardId: string, remembered: boolean): Promise<void> {
    if (!cardId || cardId.trim().length === 0) {
      throw new ValidationError('cardId', 'Card ID is required');
    }

    try {
      const flashcard = await db.flashcards.get(cardId);

      if (!flashcard) {
        throw new ValidationError('cardId', 'Flashcard not found');
      }

      const now = new Date();
      let newInterval: number;
      let newNextReviewDate: Date;

      if (remembered) {
        // 记住：间隔索引 +1（最大为 5）
        newInterval = Math.min(flashcard.currentInterval + 1, REVIEW_INTERVALS.length - 1);
        newNextReviewDate = calculateNextReviewDate(newInterval);
      } else {
        // 忘记：重置为 0，明天复习
        newInterval = 0;
        newNextReviewDate = getTomorrow();
      }

      // 更新 Flashcard
      await db.flashcards.update(cardId, {
        currentInterval: newInterval,
        nextReviewDate: newNextReviewDate,
        reviewCount: flashcard.reviewCount + 1,
        lastReviewDate: now,
      });

      // 创建复习记录
      const reviewRecord: ReviewRecord = {
        id: generateId(),
        flashcardId: cardId,
        reviewedAt: now,
        remembered,
      };

      await db.reviewRecords.add(reviewRecord);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError(
        'write',
        'flashcard',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 移除表达的复习计划
   * 同时删除关联的复习记录
   * @param expressionId 表达ID
   */
  async removeSchedule(expressionId: string): Promise<void> {
    if (!expressionId || expressionId.trim().length === 0) {
      throw new ValidationError('expressionId', 'Expression ID is required');
    }

    try {
      // 查找关联的 Flashcard
      const flashcard = await db.flashcards
        .where('expressionId')
        .equals(expressionId)
        .first();

      if (flashcard) {
        // 删除关联的复习记录
        await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();

        // 删除 Flashcard
        await db.flashcards.delete(flashcard.id);
      }
    } catch (error) {
      throw new DatabaseError(
        'delete',
        'flashcard',
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * 默认 FlashcardGenerator 实例
 */
export const flashcardGenerator = new FlashcardGenerator();
