import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { NewsStorageService } from '../NewsStorageService';
import { DailyNews, UpdateResult, NewsItem, NewsDomain } from '../../types/news';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUpdateResult(overrides: Partial<UpdateResult> = {}): UpdateResult {
  return {
    success: true,
    completedAt: new Date().toISOString(),
    articlesFetched: 5,
    newsItemsGenerated: 3,
    retryCount: 0,
    errors: [],
    ...overrides,
  };
}

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'item-1',
    topicSummary: 'Test topic summary',
    domain: 'tech' as NewsDomain,
    secondaryDomains: [],
    chineseArticle: null,
    englishArticle: {
      articleId: 'art-1',
      sourceId: 'reuters',
      sourceName: 'Reuters',
      title: 'Test Article',
      summary: 'Summary',
      content: 'Content',
      url: 'https://example.com/article',
      publishedAt: '2024-01-15T08:00:00.000Z',
    },
    pairingStatus: 'en-only',
    importanceScore: 0.85,
    rank: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDailyNews(date: string, items?: NewsItem[]): DailyNews {
  return {
    date,
    items: items || [makeNewsItem()],
    generatedAt: new Date().toISOString(),
    updateResult: makeUpdateResult(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsStorageService', () => {
  let tmpDir: string;
  let service: NewsStorageService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'news-storage-test-'));
    service = new NewsStorageService(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('saveDailyNews', () => {
    it('writes a JSON file named by date', async () => {
      const daily = makeDailyNews('2024-06-15');
      await service.saveDailyNews(daily);

      const filePath = path.join(tmpDir, 'news', '2024-06-15.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.date).toBe('2024-06-15');
      expect(parsed.items).toHaveLength(1);
    });

    it('overwrites existing file for the same date', async () => {
      await service.saveDailyNews(makeDailyNews('2024-06-15', [makeNewsItem({ id: 'old' })]));
      await service.saveDailyNews(makeDailyNews('2024-06-15', [makeNewsItem({ id: 'new' })]));

      const result = await service.getDailyNews('2024-06-15');
      expect(result!.items[0].id).toBe('new');
    });
  });

  describe('getDailyNews', () => {
    it('returns the saved daily news for a given date', async () => {
      const daily = makeDailyNews('2024-03-10');
      await service.saveDailyNews(daily);

      const result = await service.getDailyNews('2024-03-10');
      expect(result).not.toBeNull();
      expect(result!.date).toBe('2024-03-10');
      expect(result!.items).toHaveLength(1);
    });

    it('returns null when no data exists for the date', async () => {
      const result = await service.getDailyNews('2099-01-01');
      expect(result).toBeNull();
    });
  });

  describe('getLatestDailyNews', () => {
    it('returns the most recent daily news by date', async () => {
      await service.saveDailyNews(makeDailyNews('2024-01-01'));
      await service.saveDailyNews(makeDailyNews('2024-06-15'));
      await service.saveDailyNews(makeDailyNews('2024-03-10'));

      const result = await service.getLatestDailyNews();
      expect(result).not.toBeNull();
      expect(result!.date).toBe('2024-06-15');
    });

    it('returns null when no news files exist', async () => {
      const result = await service.getLatestDailyNews();
      expect(result).toBeNull();
    });
  });

  describe('getNewsItemById', () => {
    it('returns the matching news item', async () => {
      const items = [
        makeNewsItem({ id: 'a1' }),
        makeNewsItem({ id: 'a2', topicSummary: 'Second topic' }),
      ];
      await service.saveDailyNews(makeDailyNews('2024-06-15', items));

      const item = await service.getNewsItemById('2024-06-15', 'a2');
      expect(item).not.toBeNull();
      expect(item!.id).toBe('a2');
      expect(item!.topicSummary).toBe('Second topic');
    });

    it('returns null when the date has no data', async () => {
      const item = await service.getNewsItemById('2099-01-01', 'a1');
      expect(item).toBeNull();
    });

    it('returns null when the item id does not exist', async () => {
      await service.saveDailyNews(makeDailyNews('2024-06-15'));
      const item = await service.getNewsItemById('2024-06-15', 'nonexistent');
      expect(item).toBeNull();
    });
  });

  describe('data directory creation', () => {
    it('creates the news directory if it does not exist', async () => {
      const freshDir = path.join(tmpDir, 'fresh');
      const freshService = new NewsStorageService(freshDir);
      await freshService.saveDailyNews(makeDailyNews('2024-01-01'));

      const result = await freshService.getDailyNews('2024-01-01');
      expect(result).not.toBeNull();
    });
  });
});
