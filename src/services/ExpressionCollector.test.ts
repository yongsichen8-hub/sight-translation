/**
 * ExpressionCollector 服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExpressionCollector } from './ExpressionCollector';
import { clearDatabase, db } from '../db';
import type { ExpressionInput } from '../types';
import { DuplicateError, ValidationError } from '../types';

describe('ExpressionCollector', () => {
  let collector: ExpressionCollector;

  // 测试用的有效表达输入
  const validInput: ExpressionInput = {
    projectId: 'test-project-id',
    chinese: '你好世界',
    english: 'Hello World',
    notes: 'Test notes',
  };

  beforeEach(async () => {
    collector = new ExpressionCollector();
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('saveExpression', () => {
    it('should save a valid expression', async () => {
      const result = await collector.saveExpression(validInput);

      expect(result.id).toBeDefined();
      expect(result.chinese).toBe('你好世界');
      expect(result.english).toBe('Hello World');
      expect(result.notes).toBe('Test notes');
      expect(result.projectId).toBe('test-project-id');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should automatically create a flashcard for the expression', async () => {
      const result = await collector.saveExpression(validInput);

      const flashcard = await db.flashcards.where('expressionId').equals(result.id).first();
      expect(flashcard).toBeDefined();
      expect(flashcard!.expressionId).toBe(result.id);
      expect(flashcard!.currentInterval).toBe(0);
      expect(flashcard!.reviewCount).toBe(0);
    });

    it('should trim whitespace from text fields', async () => {
      const inputWithWhitespace: ExpressionInput = {
        ...validInput,
        chinese: '  你好世界  ',
        english: '  Hello World  ',
        notes: '  Notes  ',
      };

      const result = await collector.saveExpression(inputWithWhitespace);

      expect(result.chinese).toBe('你好世界');
      expect(result.english).toBe('Hello World');
      expect(result.notes).toBe('Notes');
    });

    it('should handle empty notes', async () => {
      const { notes: _notes, ...inputWithoutNotes } = validInput;
      void _notes;

      const result = await collector.saveExpression(inputWithoutNotes);

      expect(result.notes).toBe('');
    });

    it('should throw ValidationError for empty chinese', async () => {
      const invalidInput: ExpressionInput = {
        ...validInput,
        chinese: '',
      };

      await expect(collector.saveExpression(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty english', async () => {
      const invalidInput: ExpressionInput = {
        ...validInput,
        english: '',
      };

      await expect(collector.saveExpression(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw DuplicateError for duplicate expression', async () => {
      await collector.saveExpression(validInput);

      const duplicateInput: ExpressionInput = {
        ...validInput,
        notes: 'Different notes',
      };

      await expect(collector.saveExpression(duplicateInput)).rejects.toThrow(DuplicateError);
    });
  });

  describe('isDuplicate', () => {
    it('should return false for non-existing expression', async () => {
      const result = await collector.isDuplicate('不存在', 'Non-existing');
      expect(result).toBe(false);
    });

    it('should return true for existing expression', async () => {
      await collector.saveExpression(validInput);

      const result = await collector.isDuplicate('你好世界', 'Hello World');
      expect(result).toBe(true);
    });

    it('should handle whitespace in duplicate check', async () => {
      await collector.saveExpression(validInput);

      const result = await collector.isDuplicate('  你好世界  ', '  Hello World  ');
      expect(result).toBe(true);
    });
  });

  describe('getExpressions', () => {
    beforeEach(async () => {
      await collector.saveExpression({
        projectId: 'project-1',
        chinese: '中文表达一',
        english: 'Chinese expression one',
      });

      await collector.saveExpression({
        projectId: 'project-1',
        chinese: '英文表达',
        english: 'English expression',
      });

      await collector.saveExpression({
        projectId: 'project-2',
        chinese: '另一个中文',
        english: 'Another Chinese',
      });
    });

    it('should return all expressions without filter', async () => {
      const result = await collector.getExpressions();
      expect(result).toHaveLength(3);
    });

    it('should filter by keyword in chinese', async () => {
      const result = await collector.getExpressions('中文');
      expect(result).toHaveLength(2);
    });

    it('should filter by keyword in english', async () => {
      const result = await collector.getExpressions('expression');
      expect(result).toHaveLength(2);
    });

    it('should filter by keyword case-insensitively', async () => {
      const result = await collector.getExpressions('CHINESE');
      expect(result).toHaveLength(1);
    });

    it('should return expressions sorted by createdAt descending', async () => {
      const result = await collector.getExpressions();
      
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          result[i + 1]!.createdAt.getTime()
        );
      }
    });
  });

  describe('updateExpression', () => {
    it('should update chinese for existing expression', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.updateExpression(expression.id, { chinese: '更新的中文' });

      const updated = await db.expressions.get(expression.id);
      expect(updated?.chinese).toBe('更新的中文');
    });

    it('should update english for existing expression', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.updateExpression(expression.id, { english: 'Updated English' });

      const updated = await db.expressions.get(expression.id);
      expect(updated?.english).toBe('Updated English');
    });

    it('should update notes for existing expression', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.updateExpression(expression.id, { notes: 'Updated notes' });

      const updated = await db.expressions.get(expression.id);
      expect(updated?.notes).toBe('Updated notes');
    });

    it('should trim whitespace from updated fields', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.updateExpression(expression.id, { notes: '  Trimmed notes  ' });

      const updated = await db.expressions.get(expression.id);
      expect(updated?.notes).toBe('Trimmed notes');
    });

    it('should update updatedAt timestamp', async () => {
      const expression = await collector.saveExpression(validInput);
      const originalUpdatedAt = expression.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await collector.updateExpression(expression.id, { notes: 'New notes' });

      const updated = await db.expressions.get(expression.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw ValidationError for non-existing expression', async () => {
      await expect(
        collector.updateExpression('non-existing-id', { notes: 'Notes' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateNotes (legacy)', () => {
    it('should update notes using legacy method', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.updateNotes(expression.id, 'Legacy updated notes');

      const updated = await db.expressions.get(expression.id);
      expect(updated?.notes).toBe('Legacy updated notes');
    });
  });

  describe('deleteExpression', () => {
    it('should delete existing expression', async () => {
      const expression = await collector.saveExpression(validInput);

      await collector.deleteExpression(expression.id);

      const deleted = await db.expressions.get(expression.id);
      expect(deleted).toBeUndefined();
    });

    it('should cascade delete associated flashcards', async () => {
      const expression = await collector.saveExpression(validInput);

      await db.flashcards.add({
        id: 'flashcard-1',
        expressionId: expression.id,
        currentInterval: 0,
        nextReviewDate: new Date(),
        reviewCount: 0,
        lastReviewDate: null,
        createdAt: new Date(),
      });

      await collector.deleteExpression(expression.id);

      const flashcard = await db.flashcards.get('flashcard-1');
      expect(flashcard).toBeUndefined();
    });

    it('should not throw error when deleting non-existing expression', async () => {
      await expect(
        collector.deleteExpression('non-existing-id')
      ).resolves.not.toThrow();
    });
  });
});
