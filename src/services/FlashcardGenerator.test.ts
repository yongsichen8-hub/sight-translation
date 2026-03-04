/**
 * FlashcardGenerator 服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FlashcardGenerator } from './FlashcardGenerator';
import { db, clearDatabase } from '../db';
import { REVIEW_INTERVALS, ValidationError } from '../types';
import type { Expression, Flashcard } from '../types';

describe('FlashcardGenerator', () => {
  let generator: FlashcardGenerator;

  // 创建测试用的表达
  async function createTestExpression(id?: string): Promise<Expression> {
    const expression: Expression = {
      id: id ?? crypto.randomUUID(),
      projectId: 'test-project-id',
      chinese: '测试术语',
      english: 'test expression',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.expressions.add(expression);
    return expression;
  }

  // 创建测试用的 Flashcard
  async function createTestFlashcard(
    expressionId: string,
    options?: Partial<Flashcard>
  ): Promise<Flashcard> {
    const flashcard: Flashcard = {
      id: crypto.randomUUID(),
      expressionId,
      currentInterval: 0,
      nextReviewDate: new Date(),
      reviewCount: 0,
      lastReviewDate: null,
      createdAt: new Date(),
      ...options,
    };
    await db.flashcards.add(flashcard);
    return flashcard;
  }

  // 获取今天的日期（不含时间）
  function getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // 获取明天的日期
  function getTomorrow(): Date {
    const today = getToday();
    return new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }

  beforeEach(async () => {
    await clearDatabase();
    generator = new FlashcardGenerator();
  });

  afterEach(async () => {
    await clearDatabase();
    vi.restoreAllMocks();
  });

  describe('scheduleExpression', () => {
    it('should create a flashcard for a new expression', async () => {
      const expression = await createTestExpression();

      await generator.scheduleExpression(expression.id);

      const flashcards = await db.flashcards.toArray();
      expect(flashcards).toHaveLength(1);
      expect(flashcards[0]!.expressionId).toBe(expression.id);
      expect(flashcards[0]!.currentInterval).toBe(0);
      expect(flashcards[0]!.reviewCount).toBe(0);
      expect(flashcards[0]!.lastReviewDate).toBeNull();
    });

    it('should set nextReviewDate to today for immediate review', async () => {
      const expression = await createTestExpression();

      await generator.scheduleExpression(expression.id);

      const flashcard = await db.flashcards.where('expressionId').equals(expression.id).first();
      const today = getToday();
      
      expect(flashcard).toBeDefined();
      expect(flashcard!.nextReviewDate.getFullYear()).toBe(today.getFullYear());
      expect(flashcard!.nextReviewDate.getMonth()).toBe(today.getMonth());
      expect(flashcard!.nextReviewDate.getDate()).toBe(today.getDate());
    });

    it('should not create duplicate flashcard for same expression', async () => {
      const expression = await createTestExpression();

      await generator.scheduleExpression(expression.id);
      await generator.scheduleExpression(expression.id);

      const flashcards = await db.flashcards.toArray();
      expect(flashcards).toHaveLength(1);
    });

    it('should throw ValidationError for empty expressionId', async () => {
      await expect(generator.scheduleExpression('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-existent expression', async () => {
      await expect(generator.scheduleExpression('non-existent-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('getDueCards', () => {
    it('should return empty array when no flashcards exist', async () => {
      const dueCards = await generator.getDueCards();
      expect(dueCards).toEqual([]);
    });

    it('should return flashcards due today', async () => {
      const expression = await createTestExpression();
      const today = getToday();
      await createTestFlashcard(expression.id, { nextReviewDate: today });

      const dueCards = await generator.getDueCards();
      expect(dueCards).toHaveLength(1);
    });

    it('should return flashcards due in the past', async () => {
      const expression = await createTestExpression();
      const yesterday = new Date(getToday().getTime() - 24 * 60 * 60 * 1000);
      await createTestFlashcard(expression.id, { nextReviewDate: yesterday });

      const dueCards = await generator.getDueCards();
      expect(dueCards).toHaveLength(1);
    });

    it('should not return flashcards due in the future', async () => {
      const expression = await createTestExpression();
      const tomorrow = getTomorrow();
      await createTestFlashcard(expression.id, { nextReviewDate: tomorrow });

      const dueCards = await generator.getDueCards();
      expect(dueCards).toHaveLength(0);
    });
  });

  describe('getDueCount', () => {
    it('should return 0 when no flashcards exist', async () => {
      const count = await generator.getDueCount();
      expect(count).toBe(0);
    });

    it('should return correct count of due flashcards', async () => {
      const expression1 = await createTestExpression();
      const expression2 = await createTestExpression();
      const today = getToday();
      
      await createTestFlashcard(expression1.id, { nextReviewDate: today });
      await createTestFlashcard(expression2.id, { nextReviewDate: today });

      const count = await generator.getDueCount();
      expect(count).toBe(2);
    });
  });

  describe('recordReview - remembered', () => {
    it('should increment currentInterval when remembered', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: 0 });

      await generator.recordReview(flashcard.id, true);

      const updated = await db.flashcards.get(flashcard.id);
      expect(updated?.currentInterval).toBe(1);
    });

    it('should update nextReviewDate based on new interval', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: 0 });

      await generator.recordReview(flashcard.id, true);

      const updated = await db.flashcards.get(flashcard.id);
      const today = getToday();
      const expectedDate = new Date(today.getTime() + REVIEW_INTERVALS[1] * 24 * 60 * 60 * 1000);
      
      expect(updated?.nextReviewDate.getDate()).toBe(expectedDate.getDate());
    });

    it('should not exceed max interval index', async () => {
      const expression = await createTestExpression();
      const maxIndex = REVIEW_INTERVALS.length - 1;
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: maxIndex });

      await generator.recordReview(flashcard.id, true);

      const updated = await db.flashcards.get(flashcard.id);
      expect(updated?.currentInterval).toBe(maxIndex);
    });

    it('should increment reviewCount', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { reviewCount: 5 });

      await generator.recordReview(flashcard.id, true);

      const updated = await db.flashcards.get(flashcard.id);
      expect(updated?.reviewCount).toBe(6);
    });

    it('should update lastReviewDate', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id);

      await generator.recordReview(flashcard.id, true);

      const updated = await db.flashcards.get(flashcard.id);
      expect(updated?.lastReviewDate).not.toBeNull();
    });

    it('should create a review record', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id);

      await generator.recordReview(flashcard.id, true);

      const records = await db.reviewRecords.toArray();
      expect(records).toHaveLength(1);
      expect(records[0]!.flashcardId).toBe(flashcard.id);
      expect(records[0]!.remembered).toBe(true);
    });
  });

  describe('recordReview - forgot', () => {
    it('should reset currentInterval to 0 when forgot', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: 3 });

      await generator.recordReview(flashcard.id, false);

      const updated = await db.flashcards.get(flashcard.id);
      expect(updated?.currentInterval).toBe(0);
    });

    it('should set nextReviewDate to tomorrow when forgot', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: 3 });

      await generator.recordReview(flashcard.id, false);

      const updated = await db.flashcards.get(flashcard.id);
      const tomorrow = getTomorrow();
      
      expect(updated?.nextReviewDate.getFullYear()).toBe(tomorrow.getFullYear());
      expect(updated?.nextReviewDate.getMonth()).toBe(tomorrow.getMonth());
      expect(updated?.nextReviewDate.getDate()).toBe(tomorrow.getDate());
    });

    it('should create a review record with remembered=false', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id);

      await generator.recordReview(flashcard.id, false);

      const records = await db.reviewRecords.toArray();
      expect(records).toHaveLength(1);
      expect(records[0]!.remembered).toBe(false);
    });
  });

  describe('recordReview - validation', () => {
    it('should throw ValidationError for empty cardId', async () => {
      await expect(generator.recordReview('', true)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-existent flashcard', async () => {
      await expect(generator.recordReview('non-existent-id', true)).rejects.toThrow(ValidationError);
    });
  });

  describe('removeSchedule', () => {
    it('should remove flashcard for expression', async () => {
      const expression = await createTestExpression();
      await createTestFlashcard(expression.id);

      await generator.removeSchedule(expression.id);

      const flashcards = await db.flashcards.toArray();
      expect(flashcards).toHaveLength(0);
    });

    it('should remove associated review records', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id);
      
      // 添加复习记录
      await db.reviewRecords.add({
        id: crypto.randomUUID(),
        flashcardId: flashcard.id,
        reviewedAt: new Date(),
        remembered: true,
      });

      await generator.removeSchedule(expression.id);

      const records = await db.reviewRecords.toArray();
      expect(records).toHaveLength(0);
    });

    it('should not throw when expression has no flashcard', async () => {
      const expression = await createTestExpression();

      await expect(generator.removeSchedule(expression.id)).resolves.not.toThrow();
    });

    it('should throw ValidationError for empty expressionId', async () => {
      await expect(generator.removeSchedule('')).rejects.toThrow(ValidationError);
    });
  });

  describe('Ebbinghaus intervals', () => {
    it('should use correct intervals [1, 2, 4, 7, 15, 30]', () => {
      expect(REVIEW_INTERVALS).toEqual([1, 2, 4, 7, 15, 30]);
    });

    it('should progress through all intervals correctly', async () => {
      const expression = await createTestExpression();
      const flashcard = await createTestFlashcard(expression.id, { currentInterval: 0 });

      // 模拟连续记住
      for (let i = 0; i < REVIEW_INTERVALS.length; i++) {
        const current = await db.flashcards.get(flashcard.id);
        expect(current?.currentInterval).toBe(Math.min(i, REVIEW_INTERVALS.length - 1));
        
        await generator.recordReview(flashcard.id, true);
      }

      const final = await db.flashcards.get(flashcard.id);
      expect(final?.currentInterval).toBe(REVIEW_INTERVALS.length - 1);
    });
  });
});
