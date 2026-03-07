import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsAggregator } from '../NewsAggregator';
import { SourceRegistryService } from '../SourceRegistryService';
import type { NewsSource } from '../../types/news';

// Minimal mock sources for testing
const makeSource = (overrides: Partial<NewsSource> = {}): NewsSource => ({
  id: 'src-1',
  name: 'Test Source',
  url: 'https://example.com/rss',
  language: 'en',
  domain: 'tech',
  tier: 'T1',
  weight: 0.9,
  enabled: true,
  ...overrides,
});

describe('NewsAggregator – fault tolerance (task 2.2)', () => {
  let aggregator: NewsAggregator;
  let registryMock: SourceRegistryService;

  beforeEach(() => {
    registryMock = {
      getSources: vi.fn().mockReturnValue([]),
      getSourceById: vi.fn(),
      getSourcesByLanguage: vi.fn(),
    } as unknown as SourceRegistryService;

    aggregator = new NewsAggregator(registryMock);
  });

  // ── Source error handling ──────────────────────────────────────────

  it('should skip an unreachable source and record a SourceError', async () => {
    const goodSource = makeSource({ id: 'good', name: 'Good' });
    const badSource = makeSource({ id: 'bad', name: 'Bad', url: 'https://bad.example.com/rss' });
    (registryMock.getSources as ReturnType<typeof vi.fn>).mockReturnValue([badSource, goodSource]);

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pubDate = new Date(now.getTime() - 60 * 1000).toUTCString();

    // Mock parseURL: bad source throws, good source returns a valid feed
    const parseURLMock = vi.fn().mockImplementation((url: string) => {
      if (url === badSource.url) {
        return Promise.reject(new Error('ENOTFOUND'));
      }
      return Promise.resolve({
        items: [{ title: 'Article', link: 'https://example.com/1', pubDate, contentSnippet: 'summary', content: 'body' }],
      });
    });
    (aggregator as any).parser = { parseURL: parseURLMock };

    const result = await aggregator.fetchArticles(since);

    // Good source articles are returned
    expect(result.articles.length).toBe(1);
    expect(result.articles[0].sourceName).toBe('Good');

    // Bad source produces a SourceError
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].sourceId).toBe('bad');
    expect(result.errors[0].error).toContain('ENOTFOUND');
  });

  // ── Timeout handling ──────────────────────────────────────────────

  it('should timeout a slow source after 30 seconds and record a SourceError', async () => {
    vi.useFakeTimers();

    const slowSource = makeSource({ id: 'slow', name: 'Slow Source' });
    (registryMock.getSources as ReturnType<typeof vi.fn>).mockReturnValue([slowSource]);

    // parseURL never resolves (simulates a hanging connection)
    const parseURLMock = vi.fn().mockReturnValue(new Promise(() => {}));
    (aggregator as any).parser = { parseURL: parseURLMock };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const resultPromise = aggregator.fetchArticles(since);

    // Advance time past the 30-second timeout
    await vi.advanceTimersByTimeAsync(31_000);

    const result = await resultPromise;

    expect(result.articles).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].sourceId).toBe('slow');
    expect(result.errors[0].error).toContain('timed out');

    vi.useRealTimers();
  });

  // ── Time window filtering ─────────────────────────────────────────

  it('should filter out articles with publishedAt outside [since, now]', async () => {
    const source = makeSource();
    (registryMock.getSources as ReturnType<typeof vi.fn>).mockReturnValue([source]);

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tooOld = new Date(since.getTime() - 60_000).toUTCString();       // before since
    const inRange = new Date(now.getTime() - 60_000).toUTCString();         // within window
    const inFuture = new Date(now.getTime() + 60 * 60_000).toUTCString();   // after now

    const parseURLMock = vi.fn().mockResolvedValue({
      items: [
        { title: 'Old', link: 'https://example.com/old', pubDate: tooOld, content: 'c' },
        { title: 'Good', link: 'https://example.com/good', pubDate: inRange, content: 'c' },
        { title: 'Future', link: 'https://example.com/future', pubDate: inFuture, content: 'c' },
      ],
    });
    (aggregator as any).parser = { parseURL: parseURLMock };

    const result = await aggregator.fetchArticles(since);

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe('Good');
  });

  // ── AggregationResult shape ───────────────────────────────────────

  it('should return a well-formed AggregationResult with articles and errors', async () => {
    (registryMock.getSources as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const result = await aggregator.fetchArticles(new Date());

    expect(result).toHaveProperty('articles');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('fetchedAt');
    expect(Array.isArray(result.articles)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.fetchedAt).toBe('string');
  });
});
