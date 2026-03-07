import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewsScheduler, StorageCallback } from '../NewsScheduler';
import { NewsAggregator } from '../NewsAggregator';
import { TopicMatcher } from '../TopicMatcher';
import { NewsRanker } from '../NewsRanker';
import { AggregationResult, DailyNews, NewsItem, NewsDomain } from '../../types/news';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'item-1',
    topicSummary: 'Test topic',
    domain: 'tech' as NewsDomain,
    secondaryDomains: [],
    chineseArticle: null,
    englishArticle: {
      articleId: 'art-1',
      sourceId: 'reuters',
      sourceName: 'Reuters',
      title: 'Test',
      summary: 'Summary',
      content: 'Content',
      url: 'https://example.com',
      publishedAt: new Date().toISOString(),
    },
    pairingStatus: 'en-only',
    importanceScore: 0.8,
    rank: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const GOOD_AGGREGATION: AggregationResult = {
  articles: [
    {
      id: 'a1',
      sourceId: 'reuters',
      sourceName: 'Reuters',
      language: 'en',
      title: 'Test Article',
      summary: 'Summary',
      content: 'Content',
      url: 'https://reuters.com/1',
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      domain: 'tech',
    },
  ],
  errors: [],
  fetchedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMocks() {
  const aggregator = {
    fetchArticles: vi.fn().mockResolvedValue(GOOD_AGGREGATION),
  } as unknown as NewsAggregator;

  const matchedItems = [makeNewsItem()];
  const matcher = {
    matchArticles: vi.fn().mockResolvedValue(matchedItems),
  } as unknown as TopicMatcher;

  const rankedItems = [makeNewsItem({ rank: 1 })];
  const ranker = {
    rankAndSelect: vi.fn().mockReturnValue(rankedItems),
  } as unknown as NewsRanker;

  const storageCallback: StorageCallback = vi.fn().mockResolvedValue(undefined);

  return { aggregator, matcher, ranker, storageCallback };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsScheduler', () => {
  let scheduler: NewsScheduler;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    vi.useFakeTimers();
    mocks = createMocks();
    scheduler = new NewsScheduler(
      mocks.aggregator,
      mocks.matcher,
      mocks.ranker,
      mocks.storageCallback,
    );
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // triggerUpdate
  // -----------------------------------------------------------------------

  describe('triggerUpdate', () => {
    it('calls aggregator → matcher → ranker → storage in order', async () => {
      vi.useRealTimers(); // triggerUpdate doesn't need fake timers
      const result = await scheduler.triggerUpdate();

      expect(mocks.aggregator.fetchArticles).toHaveBeenCalledOnce();
      expect(mocks.matcher.matchArticles).toHaveBeenCalledWith(GOOD_AGGREGATION.articles);
      expect(mocks.ranker.rankAndSelect).toHaveBeenCalledOnce();
      expect(mocks.storageCallback).toHaveBeenCalledOnce();

      // Verify the DailyNews passed to storage
      const savedNews = (mocks.storageCallback as ReturnType<typeof vi.fn>).mock.calls[0][0] as DailyNews;
      expect(savedNews.items).toHaveLength(1);
      expect(savedNews.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(savedNews.updateResult.success).toBe(true);

      expect(result.success).toBe(true);
      expect(result.articlesFetched).toBe(1);
      expect(result.newsItemsGenerated).toBe(1);
    });

    it('returns UpdateResult with valid completedAt timestamp', async () => {
      vi.useRealTimers();
      const result = await scheduler.triggerUpdate();
      const ts = Date.parse(result.completedAt);
      expect(isNaN(ts)).toBe(false);
    });

    it('includes aggregation errors in UpdateResult.errors', async () => {
      vi.useRealTimers();
      (mocks.aggregator.fetchArticles as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...GOOD_AGGREGATION,
        errors: [
          { sourceId: 'bbc', sourceName: 'BBC', error: 'timeout', timestamp: new Date().toISOString() },
        ],
      });

      const result = await scheduler.triggerUpdate();
      expect(result.errors).toContain('BBC: timeout');
    });
  });

  // -----------------------------------------------------------------------
  // executeWithRetry
  // -----------------------------------------------------------------------

  describe('executeWithRetry', () => {
    it('succeeds on first attempt without retrying', async () => {
      vi.useRealTimers();
      const result = await scheduler.executeWithRetry();
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(0);
    });

    it('retries up to 3 times on failure then returns failed result', async () => {
      // Make triggerUpdate always fail
      (mocks.aggregator.fetchArticles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );

      // Stub the delay so we don't actually wait 15 minutes
      const delaySpy = vi.spyOn(scheduler, 'delay').mockResolvedValue(undefined);

      const result = await scheduler.executeWithRetry();

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3);
      expect(result.errors).toContain('Network error');

      // Should have called delay 3 times (between attempts 0→1, 1→2, 2→3)
      expect(delaySpy).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledWith(15 * 60 * 1000);
    });

    it('succeeds on second attempt after one failure', async () => {
      (mocks.aggregator.fetchArticles as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(GOOD_AGGREGATION);

      const delaySpy = vi.spyOn(scheduler, 'delay').mockResolvedValue(undefined);

      const result = await scheduler.executeWithRetry();

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(delaySpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // start / stop
  // -----------------------------------------------------------------------

  describe('start / stop', () => {
    it('start() creates a cron job and stop() clears it', () => {
      scheduler.start();
      // Calling start again should be a no-op (no duplicate jobs)
      scheduler.start();
      scheduler.stop();
      // Calling stop again should be safe
      scheduler.stop();
    });
  });

  // -----------------------------------------------------------------------
  // getLastResult
  // -----------------------------------------------------------------------

  describe('getLastResult', () => {
    it('returns null before any update', () => {
      expect(scheduler.getLastResult()).toBeNull();
    });

    it('returns the result after a successful update', async () => {
      vi.useRealTimers();
      await scheduler.triggerUpdate();
      const last = scheduler.getLastResult();
      expect(last).not.toBeNull();
      expect(last!.success).toBe(true);
    });
  });
});
