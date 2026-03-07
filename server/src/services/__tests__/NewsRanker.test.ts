import { describe, it, expect, beforeEach } from 'vitest';
import { NewsRanker } from '../NewsRanker';
import { SourceRegistryService } from '../SourceRegistryService';
import { NewsItem, NewsDomain } from '../../types/news';

function makeArticleRef(overrides: Partial<{
  sourceId: string;
  publishedAt: string;
}> = {}) {
  return {
    articleId: 'art-1',
    sourceId: overrides.sourceId ?? 'reuters',
    sourceName: 'Reuters',
    title: 'Test Article',
    summary: 'Summary',
    content: 'Content',
    url: 'https://example.com/article',
    publishedAt: overrides.publishedAt ?? new Date().toISOString(),
  };
}

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'item-1',
    topicSummary: 'Test topic',
    domain: 'tech' as NewsDomain,
    secondaryDomains: [],
    chineseArticle: null,
    englishArticle: makeArticleRef(),
    pairingStatus: 'en-only',
    importanceScore: 0,
    rank: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NewsRanker', () => {
  let ranker: NewsRanker;
  let registry: SourceRegistryService;

  beforeEach(() => {
    registry = new SourceRegistryService();
    ranker = new NewsRanker(registry);
  });

  describe('computeImportanceScore', () => {
    it('returns a score between 0 and 1', () => {
      const item = makeNewsItem({
        englishArticle: makeArticleRef({ sourceId: 'reuters' }),
      });
      const score = ranker.computeImportanceScore(item);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('gives higher score to T1 sources than T2 sources', () => {
      const now = new Date().toISOString();
      const t1Item = makeNewsItem({
        englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
      });
      const t2Item = makeNewsItem({
        englishArticle: makeArticleRef({ sourceId: 'en-techcrunch', publishedAt: now }),
      });
      const t1Score = ranker.computeImportanceScore(t1Item);
      const t2Score = ranker.computeImportanceScore(t2Item);
      expect(t1Score).toBeGreaterThan(t2Score);
    });

    it('gives higher score to paired items than single-language items', () => {
      const now = new Date().toISOString();
      const paired = makeNewsItem({
        chineseArticle: makeArticleRef({ sourceId: 'xinhua', publishedAt: now }),
        englishArticle: makeArticleRef({ sourceId: 'reuters', publishedAt: now }),
        pairingStatus: 'paired',
      });
      const single = makeNewsItem({
        chineseArticle: null,
        englishArticle: makeArticleRef({ sourceId: 'reuters', publishedAt: now }),
        pairingStatus: 'en-only',
      });
      expect(ranker.computeImportanceScore(paired)).toBeGreaterThan(
        ranker.computeImportanceScore(single),
      );
    });

    it('gives higher score to more recent articles', () => {
      const recent = makeNewsItem({
        englishArticle: makeArticleRef({
          sourceId: 'reuters',
          publishedAt: new Date().toISOString(),
        }),
      });
      const old = makeNewsItem({
        englishArticle: makeArticleRef({
          sourceId: 'reuters',
          publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        }),
      });
      expect(ranker.computeImportanceScore(recent)).toBeGreaterThan(
        ranker.computeImportanceScore(old),
      );
    });

    it('returns 0 for item with no articles', () => {
      const item = makeNewsItem({
        chineseArticle: null,
        englishArticle: null,
        pairingStatus: 'en-only',
      });
      expect(ranker.computeImportanceScore(item)).toBe(0);
    });
  });

  describe('rankAndSelect', () => {
    it('returns exactly targetCount items when enough candidates', () => {
      const items = Array.from({ length: 15 }, (_, i) =>
        makeNewsItem({
          id: `item-${i}`,
          englishArticle: makeArticleRef({
            sourceId: 'reuters',
            publishedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
          }),
        }),
      );
      const result = ranker.rankAndSelect(items, 10);
      expect(result).toHaveLength(10);
    });

    it('returns all items when fewer than targetCount', () => {
      const items = [
        makeNewsItem({ id: 'a' }),
        makeNewsItem({ id: 'b' }),
      ];
      const result = ranker.rankAndSelect(items, 10);
      expect(result).toHaveLength(2);
    });

    it('sorts items by importanceScore descending', () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        makeNewsItem({
          id: `item-${i}`,
          englishArticle: makeArticleRef({
            sourceId: 'reuters',
            publishedAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000).toISOString(),
          }),
        }),
      );
      const result = ranker.rankAndSelect(items, 5);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].importanceScore).toBeGreaterThanOrEqual(
          result[i + 1].importanceScore,
        );
      }
    });

    it('assigns 1-based rank to each item', () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        makeNewsItem({ id: `item-${i}` }),
      );
      const result = ranker.rankAndSelect(items, 5);
      result.forEach((item, index) => {
        expect(item.rank).toBe(index + 1);
      });
    });

    it('sets importanceScore on each returned item', () => {
      const items = [makeNewsItem()];
      const result = ranker.rankAndSelect(items, 10);
      expect(result[0].importanceScore).toBeGreaterThan(0);
    });

    it('returns empty array for empty input', () => {
      const result = ranker.rankAndSelect([], 10);
      expect(result).toHaveLength(0);
    });

    it('preserves domain and secondaryDomains from input', () => {
      const item = makeNewsItem({
        domain: 'ai',
        secondaryDomains: ['tech'],
      });
      const result = ranker.rankAndSelect([item], 10);
      expect(result[0].domain).toBe('ai');
      expect(result[0].secondaryDomains).toEqual(['tech']);
    });

    it('ensures at least 3 domains are covered when candidates span 4 domains', () => {
      const now = new Date().toISOString();
      // 8 tech items + 1 ai + 1 economy + 1 politics = 11 candidates
      const items: NewsItem[] = [];
      for (let i = 0; i < 8; i++) {
        items.push(
          makeNewsItem({
            id: `tech-${i}`,
            domain: 'tech',
            englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
          }),
        );
      }
      items.push(
        makeNewsItem({
          id: 'ai-0',
          domain: 'ai',
          englishArticle: makeArticleRef({ sourceId: 'en-techcrunch', publishedAt: now }),
        }),
      );
      items.push(
        makeNewsItem({
          id: 'economy-0',
          domain: 'economy',
          englishArticle: makeArticleRef({ sourceId: 'en-techcrunch', publishedAt: now }),
        }),
      );
      items.push(
        makeNewsItem({
          id: 'politics-0',
          domain: 'politics',
          englishArticle: makeArticleRef({ sourceId: 'en-techcrunch', publishedAt: now }),
        }),
      );

      const result = ranker.rankAndSelect(items, 10);
      const domains = new Set(result.map((r) => r.domain));
      expect(domains.size).toBeGreaterThanOrEqual(3);
    });

    it('fills up to targetCount from remaining domains when a domain has no news', () => {
      const now = new Date().toISOString();
      // Only 3 domains present (no politics), 12 candidates total
      const items: NewsItem[] = [];
      for (let i = 0; i < 5; i++) {
        items.push(
          makeNewsItem({
            id: `tech-${i}`,
            domain: 'tech',
            englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
          }),
        );
      }
      for (let i = 0; i < 4; i++) {
        items.push(
          makeNewsItem({
            id: `ai-${i}`,
            domain: 'ai',
            englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
          }),
        );
      }
      for (let i = 0; i < 3; i++) {
        items.push(
          makeNewsItem({
            id: `economy-${i}`,
            domain: 'economy',
            englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
          }),
        );
      }

      const result = ranker.rankAndSelect(items, 10);
      expect(result).toHaveLength(10);
      // Should still cover the 3 available domains
      const domains = new Set(result.map((r) => r.domain));
      expect(domains.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('ensureDomainCoverage', () => {
    const now = new Date().toISOString();

    function makeScoredItem(id: string, domain: NewsDomain, score: number): NewsItem {
      return makeNewsItem({
        id,
        domain,
        importanceScore: score,
        englishArticle: makeArticleRef({ sourceId: 'en-reuters', publishedAt: now }),
      });
    }

    it('returns ranked unchanged when minDomains is already met', () => {
      const ranked = [
        makeScoredItem('a', 'tech', 0.9),
        makeScoredItem('b', 'ai', 0.8),
        makeScoredItem('c', 'economy', 0.7),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 3, ranked, 10);
      expect(result).toEqual(ranked);
    });

    it('returns empty array for empty input', () => {
      const result = ranker.ensureDomainCoverage([], 3, [], 10);
      expect(result).toHaveLength(0);
    });

    it('swaps lowest-scored duplicate-domain item with missing domain item', () => {
      // All tech — only 1 domain covered
      const ranked = [
        makeScoredItem('t1', 'tech', 0.9),
        makeScoredItem('t2', 'tech', 0.8),
        makeScoredItem('t3', 'tech', 0.7),
        makeScoredItem('t4', 'tech', 0.6),
      ];
      const pool = [
        ...ranked,
        makeScoredItem('ai-1', 'ai', 0.5),
        makeScoredItem('eco-1', 'economy', 0.4),
        makeScoredItem('pol-1', 'politics', 0.3),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 3, pool, 4);
      const domains = new Set(result.map((r) => r.domain));
      expect(domains.size).toBeGreaterThanOrEqual(3);
      expect(result).toHaveLength(4);
    });

    it('maintains targetCount after swaps', () => {
      const ranked = [
        makeScoredItem('t1', 'tech', 0.9),
        makeScoredItem('t2', 'tech', 0.8),
        makeScoredItem('t3', 'tech', 0.7),
        makeScoredItem('t4', 'tech', 0.6),
        makeScoredItem('t5', 'tech', 0.5),
      ];
      const pool = [
        ...ranked,
        makeScoredItem('ai-1', 'ai', 0.45),
        makeScoredItem('eco-1', 'economy', 0.35),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 3, pool, 5);
      expect(result).toHaveLength(5);
    });

    it('result is sorted by importanceScore descending after swaps', () => {
      const ranked = [
        makeScoredItem('t1', 'tech', 0.9),
        makeScoredItem('t2', 'tech', 0.8),
        makeScoredItem('t3', 'tech', 0.7),
      ];
      const pool = [
        ...ranked,
        makeScoredItem('ai-1', 'ai', 0.85),
        makeScoredItem('eco-1', 'economy', 0.4),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 3, pool, 3);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].importanceScore).toBeGreaterThanOrEqual(
          result[i + 1].importanceScore,
        );
      }
    });

    it('does not introduce duplicate items', () => {
      const ranked = [
        makeScoredItem('t1', 'tech', 0.9),
        makeScoredItem('t2', 'tech', 0.8),
      ];
      const pool = [
        ...ranked,
        makeScoredItem('ai-1', 'ai', 0.5),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 2, pool, 2);
      const ids = result.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('does nothing when no candidates exist for missing domains', () => {
      // Only tech in both ranked and pool
      const ranked = [
        makeScoredItem('t1', 'tech', 0.9),
        makeScoredItem('t2', 'tech', 0.8),
      ];
      const result = ranker.ensureDomainCoverage(ranked, 3, ranked, 2);
      expect(result).toEqual(ranked);
    });
  });
});
