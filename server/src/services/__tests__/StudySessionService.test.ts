import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileStorageService } from '../FileStorageService';
import { StudySessionService } from '../StudySessionService';
import { CreateSessionInput } from '../../types/briefing';

const TEST_USER = 'test-user';

function makeInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    newsEntryId: 'entry-1',
    newsDate: '2025-01-15',
    chineseTitle: '测试新闻标题',
    chineseContent: '这是一条测试新闻的完整中文内容。',
    ...overrides,
  };
}

describe('StudySessionService', () => {
  let tmpDir: string;
  let fileStorage: FileStorageService;
  let service: StudySessionService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-session-test-'));
    fileStorage = new FileStorageService(tmpDir);
    service = new StudySessionService(fileStorage);
    await fileStorage.ensureUserDir(TEST_USER);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('creates a session with pending status and null english fields', async () => {
      const session = await service.createSession(TEST_USER, makeInput());

      expect(session.id).toBeTruthy();
      expect(session.newsEntryId).toBe('entry-1');
      expect(session.newsDate).toBe('2025-01-15');
      expect(session.chineseTitle).toBe('测试新闻标题');
      expect(session.chineseContent).toBe('这是一条测试新闻的完整中文内容。');
      expect(session.englishUrl).toBeNull();
      expect(session.englishContent).toBeNull();
      expect(session.englishHtmlContent).toBeNull();
      expect(session.englishSourceName).toBeNull();
      expect(session.status).toBe('pending');
      expect(session.createdAt).toBeTruthy();
      expect(session.updatedAt).toBeTruthy();
    });

    it('persists the session to storage', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      const sessions = await service.getSessions(TEST_USER);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(created.id);
    });
  });

  describe('getSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      const sessions = await service.getSessions(TEST_USER);
      expect(sessions).toEqual([]);
    });

    it('returns all created sessions', async () => {
      await service.createSession(TEST_USER, makeInput({ newsEntryId: 'e1' }));
      await service.createSession(TEST_USER, makeInput({ newsEntryId: 'e2' }));

      const sessions = await service.getSessions(TEST_USER);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getSession', () => {
    it('returns the session by id', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      const found = await service.getSession(TEST_USER, created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.chineseTitle).toBe('测试新闻标题');
    });

    it('returns null for non-existent session', async () => {
      const found = await service.getSession(TEST_USER, 'non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('updates fields on an existing session', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      await service.updateSession(TEST_USER, created.id, {
        englishUrl: 'https://example.com/article',
      });

      const updated = await service.getSession(TEST_USER, created.id);
      expect(updated!.englishUrl).toBe('https://example.com/article');
    });

    it('auto-sets status to completed when englishContent is provided', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      expect(created.status).toBe('pending');

      await service.updateSession(TEST_USER, created.id, {
        englishContent: 'English article content here.',
        englishHtmlContent: '<p>English article content here.</p>',
        englishSourceName: 'Reuters',
        englishUrl: 'https://reuters.com/article',
      });

      const updated = await service.getSession(TEST_USER, created.id);
      expect(updated!.status).toBe('completed');
      expect(updated!.englishContent).toBe('English article content here.');
    });

    it('updates updatedAt timestamp', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await service.updateSession(TEST_USER, created.id, {
        englishUrl: 'https://example.com',
      });

      const updated = await service.getSession(TEST_USER, created.id);
      expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('does not allow overwriting the session id', async () => {
      const created = await service.createSession(TEST_USER, makeInput());
      await service.updateSession(TEST_USER, created.id, {
        id: 'hacked-id',
      } as any);

      const updated = await service.getSession(TEST_USER, created.id);
      expect(updated!.id).toBe(created.id);
    });

    it('throws when session does not exist', async () => {
      await expect(
        service.updateSession(TEST_USER, 'non-existent', { englishUrl: 'https://example.com' })
      ).rejects.toThrow('NOT_FOUND');
    });
  });
});
