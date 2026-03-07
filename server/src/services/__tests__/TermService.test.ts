import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileStorageService } from '../FileStorageService';
import { TermService } from '../TermService';
import { CreateTermInput, BriefingDomain } from '../../types/briefing';

const TEST_USER = 'test-user';

function makeInput(overrides: Partial<CreateTermInput> = {}): CreateTermInput {
  return {
    english: 'inflation',
    chinese: '通货膨胀',
    domain: 'economy' as BriefingDomain,
    context: 'Inflation rates have risen sharply.',
    studySessionId: 'session-1',
    sourceArticleTitle: 'Economic Outlook 2025',
    ...overrides,
  };
}

describe('TermService', () => {
  let tmpDir: string;
  let fileStorage: FileStorageService;
  let service: TermService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'term-service-test-'));
    fileStorage = new FileStorageService(tmpDir);
    service = new TermService(fileStorage);
    await fileStorage.ensureUserDir(TEST_USER);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createTerm', () => {
    it('creates a term with all fields populated', async () => {
      const term = await service.createTerm(TEST_USER, makeInput());

      expect(term.id).toBeTruthy();
      expect(term.english).toBe('inflation');
      expect(term.chinese).toBe('通货膨胀');
      expect(term.domain).toBe('economy');
      expect(term.context).toBe('Inflation rates have risen sharply.');
      expect(term.studySessionId).toBe('session-1');
      expect(term.sourceArticleTitle).toBe('Economic Outlook 2025');
      expect(term.createdAt).toBeTruthy();
      expect(term.updatedAt).toBeTruthy();
    });

    it('persists the term to storage', async () => {
      const created = await service.createTerm(TEST_USER, makeInput());
      const terms = await service.getTerms(TEST_USER);

      expect(terms).toHaveLength(1);
      expect(terms[0].id).toBe(created.id);
    });

    it('throws VALIDATION_ERROR when chinese is empty', async () => {
      await expect(
        service.createTerm(TEST_USER, makeInput({ chinese: '' }))
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('throws VALIDATION_ERROR when chinese is whitespace-only', async () => {
      await expect(
        service.createTerm(TEST_USER, makeInput({ chinese: '   ' }))
      ).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('getTerms', () => {
    it('returns empty array when no terms exist', async () => {
      const terms = await service.getTerms(TEST_USER);
      expect(terms).toEqual([]);
    });

    it('returns all terms sorted by createdAt descending', async () => {
      await service.createTerm(TEST_USER, makeInput({ english: 'first' }));
      await new Promise((r) => setTimeout(r, 10));
      await service.createTerm(TEST_USER, makeInput({ english: 'second' }));

      const terms = await service.getTerms(TEST_USER);
      expect(terms).toHaveLength(2);
      expect(terms[0].english).toBe('second');
      expect(terms[1].english).toBe('first');
    });

    it('filters by domain', async () => {
      await service.createTerm(TEST_USER, makeInput({ domain: 'economy' }));
      await service.createTerm(TEST_USER, makeInput({ domain: 'ai-tech' }));

      const terms = await service.getTerms(TEST_USER, { domain: 'economy' });
      expect(terms).toHaveLength(1);
      expect(terms[0].domain).toBe('economy');
    });

    it('filters by keyword in english (case-insensitive)', async () => {
      await service.createTerm(TEST_USER, makeInput({ english: 'Inflation' }));
      await service.createTerm(TEST_USER, makeInput({ english: 'GDP' }));

      const terms = await service.getTerms(TEST_USER, { keyword: 'inflation' });
      expect(terms).toHaveLength(1);
      expect(terms[0].english).toBe('Inflation');
    });

    it('filters by keyword in chinese', async () => {
      await service.createTerm(TEST_USER, makeInput({ english: 'inflation', chinese: '通货膨胀' }));
      await service.createTerm(TEST_USER, makeInput({ english: 'GDP', chinese: '国内生产总值' }));

      const terms = await service.getTerms(TEST_USER, { keyword: '膨胀' });
      expect(terms).toHaveLength(1);
      expect(terms[0].english).toBe('inflation');
    });

    it('supports combined domain and keyword filters', async () => {
      await service.createTerm(TEST_USER, makeInput({ english: 'inflation', domain: 'economy' }));
      await service.createTerm(TEST_USER, makeInput({ english: 'neural network', domain: 'ai-tech', chinese: '神经网络' }));
      await service.createTerm(TEST_USER, makeInput({ english: 'trade deficit', domain: 'economy', chinese: '贸易逆差' }));

      const terms = await service.getTerms(TEST_USER, { domain: 'economy', keyword: 'trade' });
      expect(terms).toHaveLength(1);
      expect(terms[0].english).toBe('trade deficit');
    });
  });

  describe('updateTerm', () => {
    it('updates fields on an existing term', async () => {
      const created = await service.createTerm(TEST_USER, makeInput());
      await service.updateTerm(TEST_USER, created.id, { chinese: '通胀' });

      const terms = await service.getTerms(TEST_USER);
      expect(terms[0].chinese).toBe('通胀');
    });

    it('updates updatedAt timestamp', async () => {
      const created = await service.createTerm(TEST_USER, makeInput());
      const originalUpdatedAt = created.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      await service.updateTerm(TEST_USER, created.id, { chinese: '通胀' });

      const terms = await service.getTerms(TEST_USER);
      expect(terms[0].updatedAt).not.toBe(originalUpdatedAt);
    });

    it('does not allow overwriting the term id', async () => {
      const created = await service.createTerm(TEST_USER, makeInput());
      await service.updateTerm(TEST_USER, created.id, { id: 'hacked-id' } as any);

      const terms = await service.getTerms(TEST_USER);
      expect(terms[0].id).toBe(created.id);
    });

    it('throws NOT_FOUND when term does not exist', async () => {
      await expect(
        service.updateTerm(TEST_USER, 'non-existent', { chinese: '新释义' })
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('deleteTerm', () => {
    it('removes the term from storage', async () => {
      const created = await service.createTerm(TEST_USER, makeInput());
      await service.deleteTerm(TEST_USER, created.id);

      const terms = await service.getTerms(TEST_USER);
      expect(terms).toHaveLength(0);
    });

    it('throws NOT_FOUND when term does not exist', async () => {
      await expect(
        service.deleteTerm(TEST_USER, 'non-existent')
      ).rejects.toThrow('NOT_FOUND');
    });

    it('only deletes the specified term', async () => {
      const term1 = await service.createTerm(TEST_USER, makeInput({ english: 'first' }));
      await service.createTerm(TEST_USER, makeInput({ english: 'second' }));

      await service.deleteTerm(TEST_USER, term1.id);

      const terms = await service.getTerms(TEST_USER);
      expect(terms).toHaveLength(1);
      expect(terms[0].english).toBe('second');
    });
  });
});
