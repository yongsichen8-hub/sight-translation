/**
 * ProjectManager 服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { db, clearDatabase } from '../db';
import { DuplicateError, ValidationError } from '../types';

// 创建测试用的 File 对象
function createTextFile(content: string, name: string): File {
  const blob = new Blob([content], { type: 'text/plain' });
  return new File([blob], name, { type: 'text/plain' });
}

describe('ProjectManager', () => {
  let projectManager: ProjectManager;

  beforeEach(async () => {
    await clearDatabase();
    projectManager = new ProjectManager();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('createProject', () => {
    it('should create a project with valid input', async () => {
      const chineseFile = createTextFile('你好。世界！', 'chinese.txt');
      const englishFile = createTextFile('Hello. World!', 'english.txt');

      const project = await projectManager.createProject({
        name: 'Test Project',
        chineseFile,
        englishFile,
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.chineseText).toBe('你好。世界！');
      expect(project.englishText).toBe('Hello. World!');
      expect(project.chineseSentences).toEqual(['你好。', '世界！']);
      expect(project.englishSentences).toEqual(['Hello.', 'World!']);
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should trim project name', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      const project = await projectManager.createProject({
        name: '  Trimmed Name  ',
        chineseFile,
        englishFile,
      });

      expect(project.name).toBe('Trimmed Name');
    });

    it('should throw DuplicateError for duplicate project name', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      await projectManager.createProject({
        name: 'Duplicate',
        chineseFile,
        englishFile,
      });

      await expect(
        projectManager.createProject({
          name: 'Duplicate',
          chineseFile,
          englishFile,
        })
      ).rejects.toThrow(DuplicateError);
    });

    it('should throw ValidationError for empty name', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      await expect(
        projectManager.createProject({
          name: '',
          chineseFile,
          englishFile,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      await expect(
        projectManager.createProject({
          name: '   ',
          chineseFile,
          englishFile,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when Chinese file is missing', async () => {
      const englishFile = createTextFile('Test.', 'english.txt');

      await expect(
        projectManager.createProject({
          name: 'Test',
          chineseFile: null as unknown as File,
          englishFile,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when English file is missing', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');

      await expect(
        projectManager.createProject({
          name: 'Test',
          chineseFile,
          englishFile: null as unknown as File,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getProjects', () => {
    it('should return empty array when no projects exist', async () => {
      const projects = await projectManager.getProjects();
      expect(projects).toEqual([]);
    });

    it('should return all projects sorted by creation time (newest first)', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      await projectManager.createProject({
        name: 'Project 1',
        chineseFile,
        englishFile,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await projectManager.createProject({
        name: 'Project 2',
        chineseFile,
        englishFile,
      });

      const projects = await projectManager.getProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0]?.name).toBe('Project 2');
      expect(projects[1]?.name).toBe('Project 1');
    });
  });

  describe('getProject', () => {
    it('should return project by id', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      const created = await projectManager.createProject({
        name: 'Test Project',
        chineseFile,
        englishFile,
      });

      const project = await projectManager.getProject(created.id);
      expect(project).not.toBeNull();
      expect(project?.id).toBe(created.id);
      expect(project?.name).toBe('Test Project');
    });

    it('should return null for non-existent id', async () => {
      const project = await projectManager.getProject('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('deleteProject', () => {
    it('should delete project by id', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      const project = await projectManager.createProject({
        name: 'To Delete',
        chineseFile,
        englishFile,
      });

      await projectManager.deleteProject(project.id);

      const deleted = await projectManager.getProject(project.id);
      expect(deleted).toBeNull();
    });

    it('should cascade delete associated expressions', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      const project = await projectManager.createProject({
        name: 'With Expressions',
        chineseFile,
        englishFile,
      });

      // Add an expression to the project
      await db.expressions.add({
        id: 'expr-1',
        projectId: project.id,
        text: 'test expression',
        contextSentence: 'test context',
        sourceLanguage: 'zh',
        targetLanguage: 'en',
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Verify expression exists
      const expressionsBefore = await db.expressions
        .where('projectId')
        .equals(project.id)
        .toArray();
      expect(expressionsBefore).toHaveLength(1);

      // Delete project
      await projectManager.deleteProject(project.id);

      // Verify expression is deleted
      const expressionsAfter = await db.expressions
        .where('projectId')
        .equals(project.id)
        .toArray();
      expect(expressionsAfter).toHaveLength(0);
    });

    it('should cascade delete associated flashcards', async () => {
      const chineseFile = createTextFile('测试。', 'chinese.txt');
      const englishFile = createTextFile('Test.', 'english.txt');

      const project = await projectManager.createProject({
        name: 'With Flashcards',
        chineseFile,
        englishFile,
      });

      // Add an expression and flashcard
      await db.expressions.add({
        id: 'expr-2',
        projectId: project.id,
        text: 'test expression',
        contextSentence: 'test context',
        sourceLanguage: 'zh',
        targetLanguage: 'en',
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.flashcards.add({
        id: 'fc-1',
        expressionId: 'expr-2',
        currentInterval: 0,
        nextReviewDate: new Date(),
        reviewCount: 0,
        lastReviewDate: null,
        createdAt: new Date(),
      });

      // Verify flashcard exists
      const flashcardsBefore = await db.flashcards
        .where('expressionId')
        .equals('expr-2')
        .toArray();
      expect(flashcardsBefore).toHaveLength(1);

      // Delete project
      await projectManager.deleteProject(project.id);

      // Verify flashcard is deleted
      const flashcardsAfter = await db.flashcards
        .where('expressionId')
        .equals('expr-2')
        .toArray();
      expect(flashcardsAfter).toHaveLength(0);
    });

    it('should not throw when deleting non-existent project', async () => {
      await expect(
        projectManager.deleteProject('non-existent-id')
      ).resolves.not.toThrow();
    });
  });
});
