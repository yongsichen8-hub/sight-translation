import { getDb } from '../db';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors';
import type {
  Objective,
  KeyResult,
  OKRData,
  CreateObjectiveDTO,
  UpdateObjectiveDTO,
  CreateKeyResultDTO,
  UpdateKeyResultDTO,
} from '../types';

export function getByQuarter(userId: number, quarter: string): OKRData {
  const db = getDb();

  const objRows = db.prepare(`
    SELECT id, userId, categoryId, quarter, title, description, createdAt, updatedAt
    FROM objectives
    WHERE userId = ? AND quarter = ?
    ORDER BY id ASC
  `).all(userId, quarter) as Array<{
    id: number; userId: number; categoryId: number; quarter: string;
    title: string; description: string; createdAt: string; updatedAt: string;
  }>;

  const objectives: Objective[] = objRows.map(obj => {
    const krRows = db.prepare(`
      SELECT id, objectiveId, description, completed, createdAt, updatedAt
      FROM key_results
      WHERE objectiveId = ?
      ORDER BY id ASC
    `).all(obj.id) as Array<{
      id: number; objectiveId: number; description: string;
      completed: number; createdAt: string; updatedAt: string;
    }>;

    return {
      ...obj,
      keyResults: krRows.map(kr => ({
        ...kr,
        completed: kr.completed === 1,
      })),
    };
  });

  return { quarter, objectives };
}

export function createObjective(userId: number, obj: CreateObjectiveDTO): Objective {
  if (!obj.title || obj.title.trim().length === 0) {
    throw new ValidationError('Objective 标题不能为空');
  }
  if (!obj.quarter || obj.quarter.trim().length === 0) {
    throw new ValidationError('季度不能为空');
  }

  const db = getDb();

  // Check that categoryId does not point to a default ("其他") category
  const category = db.prepare(
    'SELECT id, isDefault FROM categories WHERE id = ? AND userId = ?'
  ).get(obj.categoryId, userId) as { id: number; isDefault: number } | undefined;

  if (!category) {
    throw new NotFoundError('分类不存在');
  }

  if (category.isDefault === 1) {
    throw new ValidationError("Objective 不可关联'其他'分类");
  }

  const result = db.prepare(`
    INSERT INTO objectives (userId, categoryId, quarter, title, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, obj.categoryId, obj.quarter.trim(), obj.title.trim(), obj.description || '');

  const row = db.prepare(
    'SELECT id, userId, categoryId, quarter, title, description, createdAt, updatedAt FROM objectives WHERE id = ?'
  ).get(result.lastInsertRowid) as {
    id: number; userId: number; categoryId: number; quarter: string;
    title: string; description: string; createdAt: string; updatedAt: string;
  };

  return { ...row, keyResults: [] };
}

export function updateObjective(userId: number, id: number, obj: UpdateObjectiveDTO): Objective {
  const db = getDb();

  const existing = db.prepare(
    'SELECT id, userId FROM objectives WHERE id = ?'
  ).get(id) as { id: number; userId: number } | undefined;

  if (!existing) {
    throw new NotFoundError('Objective 不存在');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  // If updating categoryId, validate it's not a default category
  if (obj.categoryId !== undefined) {
    const category = db.prepare(
      'SELECT id, isDefault FROM categories WHERE id = ? AND userId = ?'
    ).get(obj.categoryId, userId) as { id: number; isDefault: number } | undefined;

    if (!category) {
      throw new NotFoundError('分类不存在');
    }

    if (category.isDefault === 1) {
      throw new ValidationError("Objective 不可关联'其他'分类");
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (obj.categoryId !== undefined) {
    updates.push('categoryId = ?');
    params.push(obj.categoryId);
  }
  if (obj.title !== undefined) {
    if (obj.title.trim().length === 0) {
      throw new ValidationError('Objective 标题不能为空');
    }
    updates.push('title = ?');
    params.push(obj.title.trim());
  }
  if (obj.description !== undefined) {
    updates.push('description = ?');
    params.push(obj.description);
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(id, userId);
    db.prepare(
      `UPDATE objectives SET ${updates.join(', ')} WHERE id = ? AND userId = ?`
    ).run(...params);
  }

  // Return the updated objective with key results
  const row = db.prepare(
    'SELECT id, userId, categoryId, quarter, title, description, createdAt, updatedAt FROM objectives WHERE id = ?'
  ).get(id) as {
    id: number; userId: number; categoryId: number; quarter: string;
    title: string; description: string; createdAt: string; updatedAt: string;
  };

  const krRows = db.prepare(
    'SELECT id, objectiveId, description, completed, createdAt, updatedAt FROM key_results WHERE objectiveId = ? ORDER BY id ASC'
  ).all(id) as Array<{
    id: number; objectiveId: number; description: string;
    completed: number; createdAt: string; updatedAt: string;
  }>;

  return {
    ...row,
    keyResults: krRows.map(kr => ({ ...kr, completed: kr.completed === 1 })),
  };
}

export function deleteObjective(userId: number, id: number): void {
  const db = getDb();

  const existing = db.prepare(
    'SELECT id, userId FROM objectives WHERE id = ?'
  ).get(id) as { id: number; userId: number } | undefined;

  if (!existing) {
    throw new NotFoundError('Objective 不存在');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  const transaction = db.transaction(() => {
    // Explicitly delete key_results (DB has ON DELETE CASCADE but handle explicitly)
    db.prepare('DELETE FROM key_results WHERE objectiveId = ?').run(id);
    db.prepare('DELETE FROM objectives WHERE id = ? AND userId = ?').run(id, userId);
  });

  transaction();
}

export function createKeyResult(userId: number, kr: CreateKeyResultDTO): KeyResult {
  if (!kr.description || kr.description.trim().length === 0) {
    throw new ValidationError('Key Result 描述不能为空');
  }

  const db = getDb();

  // Verify the objective exists and belongs to the user
  const objective = db.prepare(
    'SELECT id, userId FROM objectives WHERE id = ?'
  ).get(kr.objectiveId) as { id: number; userId: number } | undefined;

  if (!objective) {
    throw new NotFoundError('Objective 不存在');
  }

  if (objective.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  const result = db.prepare(`
    INSERT INTO key_results (objectiveId, description, completed)
    VALUES (?, ?, 0)
  `).run(kr.objectiveId, kr.description.trim());

  const row = db.prepare(
    'SELECT id, objectiveId, description, completed, createdAt, updatedAt FROM key_results WHERE id = ?'
  ).get(result.lastInsertRowid) as {
    id: number; objectiveId: number; description: string;
    completed: number; createdAt: string; updatedAt: string;
  };

  return { ...row, completed: row.completed === 1 };
}

export function updateKeyResult(userId: number, id: number, kr: UpdateKeyResultDTO): KeyResult {
  const db = getDb();

  // Get the key result and verify ownership through the objective
  const existing = db.prepare(`
    SELECT kr.id, kr.objectiveId, o.userId
    FROM key_results kr
    JOIN objectives o ON o.id = kr.objectiveId
    WHERE kr.id = ?
  `).get(id) as { id: number; objectiveId: number; userId: number } | undefined;

  if (!existing) {
    throw new NotFoundError('Key Result 不存在');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (kr.description !== undefined) {
    if (kr.description.trim().length === 0) {
      throw new ValidationError('Key Result 描述不能为空');
    }
    updates.push('description = ?');
    params.push(kr.description.trim());
  }
  if (kr.completed !== undefined) {
    updates.push('completed = ?');
    params.push(kr.completed ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(id);
    db.prepare(
      `UPDATE key_results SET ${updates.join(', ')} WHERE id = ?`
    ).run(...params);
  }

  const row = db.prepare(
    'SELECT id, objectiveId, description, completed, createdAt, updatedAt FROM key_results WHERE id = ?'
  ).get(id) as {
    id: number; objectiveId: number; description: string;
    completed: number; createdAt: string; updatedAt: string;
  };

  return { ...row, completed: row.completed === 1 };
}

export function deleteKeyResult(userId: number, id: number): void {
  const db = getDb();

  // Get the key result and verify ownership through the objective
  const existing = db.prepare(`
    SELECT kr.id, o.userId
    FROM key_results kr
    JOIN objectives o ON o.id = kr.objectiveId
    WHERE kr.id = ?
  `).get(id) as { id: number; userId: number } | undefined;

  if (!existing) {
    throw new NotFoundError('Key Result 不存在');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  db.prepare('DELETE FROM key_results WHERE id = ?').run(id);
}
