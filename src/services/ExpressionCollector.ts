/**
 * ExpressionCollector 服务
 * 管理用户收藏的术语
 */

import { db } from '../db';
import type { Expression, ExpressionInput, Flashcard } from '../types';
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
 * 获取今天的日期（不含时间部分）
 */
function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * ExpressionCollector 接口
 */
export interface IExpressionCollector {
  /**
   * 保存术语
   * @param expression 要保存的术语
   * @returns 保存后的术语（含ID）
   */
  saveExpression(expression: ExpressionInput): Promise<Expression>;

  /**
   * 获取所有术语
   * @param keyword 可选搜索关键词
   * @returns 术语列表
   */
  getExpressions(keyword?: string): Promise<Expression[]>;

  /**
   * 更新术语
   * @param id 术语ID
   * @param updates 更新内容
   */
  updateExpression(id: string, updates: Partial<Pick<Expression, 'chinese' | 'english' | 'notes'>>): Promise<void>;

  /**
   * 删除术语
   * @param id 术语ID
   */
  deleteExpression(id: string): Promise<void>;
}

/**
 * ExpressionCollector 实现类
 */
export class ExpressionCollector implements IExpressionCollector {
  /**
   * 验证术语输入
   */
  private validateInput(input: ExpressionInput): void {
    if (!input.chinese || input.chinese.trim().length === 0) {
      throw new ValidationError('chinese', '请输入中文术语');
    }

    if (!input.english || input.english.trim().length === 0) {
      throw new ValidationError('english', '请输入英文术语');
    }

    if (!input.projectId || input.projectId.trim().length === 0) {
      throw new ValidationError('projectId', 'Project ID is required');
    }
  }

  /**
   * 检查术语是否已存在（中英文都相同）
   */
  async isDuplicate(chinese: string, english: string): Promise<boolean> {
    try {
      const existing = await db.expressions
        .filter(e => e.chinese === chinese.trim() && e.english === english.trim())
        .first();
      return existing !== undefined;
    } catch (error) {
      throw new DatabaseError('read', 'expression', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 保存术语并自动创建 Flashcard
   */
  async saveExpression(expression: ExpressionInput): Promise<Expression> {
    this.validateInput(expression);

    const chinese = expression.chinese.trim();
    const english = expression.english.trim();

    if (await this.isDuplicate(chinese, english)) {
      throw new DuplicateError('expression', `${chinese} / ${english}`);
    }

    try {
      const now = new Date();
      const newExpression: Expression = {
        id: generateId(),
        projectId: expression.projectId.trim(),
        chinese,
        english,
        notes: expression.notes?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
      };

      await db.expressions.add(newExpression);

      // 自动创建 Flashcard，立即可以复习
      const flashcard: Flashcard = {
        id: generateId(),
        expressionId: newExpression.id,
        currentInterval: 0,
        nextReviewDate: getToday(),
        reviewCount: 0,
        lastReviewDate: null,
        createdAt: now,
      };
      await db.flashcards.add(flashcard);

      return newExpression;
    } catch (error) {
      if (error instanceof DuplicateError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('write', 'expression', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 导入术语（不需要 projectId，用于 Excel 导入）
   */
  async importExpression(data: { chinese: string; english: string; notes?: string }): Promise<Expression> {
    if (!data.chinese || data.chinese.trim().length === 0) {
      throw new ValidationError('chinese', '请输入中文术语');
    }
    if (!data.english || data.english.trim().length === 0) {
      throw new ValidationError('english', '请输入英文术语');
    }

    const chinese = data.chinese.trim();
    const english = data.english.trim();

    if (await this.isDuplicate(chinese, english)) {
      throw new DuplicateError('expression', `${chinese} / ${english}`);
    }

    try {
      const now = new Date();
      const newExpression: Expression = {
        id: generateId(),
        projectId: '__imported__', // 导入的术语使用特殊标记
        chinese,
        english,
        notes: data.notes?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
      };

      await db.expressions.add(newExpression);

      // 自动创建 Flashcard
      const flashcard: Flashcard = {
        id: generateId(),
        expressionId: newExpression.id,
        currentInterval: 0,
        nextReviewDate: getToday(),
        reviewCount: 0,
        lastReviewDate: null,
        createdAt: now,
      };
      await db.flashcards.add(flashcard);

      return newExpression;
    } catch (error) {
      if (error instanceof DuplicateError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('write', 'expression', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取所有术语
   * 包含旧数据格式的兼容性处理
   */
  async getExpressions(keyword?: string): Promise<Expression[]> {
    try {
      const rawExpressions = await db.expressions.toArray();
      
      // 兼容旧数据格式：将旧格式转换为新格式
      let expressions: Expression[] = rawExpressions.map((expr) => {
        // 检查是否是旧格式数据（有 text 字段但没有 chinese/english 字段）
        const oldExpr = expr as Expression & { text?: string; sourceLanguage?: string };
        if (oldExpr.text && !expr.chinese && !expr.english) {
          // 旧格式：根据 sourceLanguage 判断是中文还是英文
          const isChinese = oldExpr.sourceLanguage === 'zh';
          return {
            ...expr,
            chinese: isChinese ? oldExpr.text : '',
            english: isChinese ? '' : oldExpr.text,
            notes: expr.notes || '',
          };
        }
        // 确保字段存在，防止 undefined 错误
        return {
          ...expr,
          chinese: expr.chinese || '',
          english: expr.english || '',
          notes: expr.notes || '',
        };
      });

      // 关键词搜索
      if (keyword) {
        const kw = keyword.toLowerCase();
        expressions = expressions.filter(
          (expr) =>
            (expr.chinese || '').toLowerCase().includes(kw) ||
            (expr.english || '').toLowerCase().includes(kw) ||
            (expr.notes || '').toLowerCase().includes(kw)
        );
      }

      // 按创建时间降序排列
      expressions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return expressions;
    } catch (error) {
      throw new DatabaseError('read', 'expressions', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 更新术语
   */
  async updateExpression(
    id: string,
    updates: Partial<Pick<Expression, 'chinese' | 'english' | 'notes'>>
  ): Promise<void> {
    try {
      const expression = await db.expressions.get(id);
      if (!expression) {
        throw new ValidationError('id', '术语不存在');
      }

      const updateData: Partial<Expression> = { updatedAt: new Date() };
      if (updates.chinese !== undefined) updateData.chinese = updates.chinese.trim();
      if (updates.english !== undefined) updateData.english = updates.english.trim();
      if (updates.notes !== undefined) updateData.notes = updates.notes.trim();

      await db.expressions.update(id, updateData);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('write', 'expression', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 更新备注（兼容旧接口）
   */
  async updateNotes(id: string, notes: string): Promise<void> {
    return this.updateExpression(id, { notes });
  }

  /**
   * 删除术语
   */
  async deleteExpression(id: string): Promise<void> {
    try {
      // 删除关联的 Flashcard 和 ReviewRecord
      const flashcard = await db.flashcards.where('expressionId').equals(id).first();
      if (flashcard) {
        await db.reviewRecords.where('flashcardId').equals(flashcard.id).delete();
        await db.flashcards.delete(flashcard.id);
      }
      await db.expressions.delete(id);
    } catch (error) {
      throw new DatabaseError('delete', 'expression', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * 默认 ExpressionCollector 实例
 */
export const expressionCollector = new ExpressionCollector();
