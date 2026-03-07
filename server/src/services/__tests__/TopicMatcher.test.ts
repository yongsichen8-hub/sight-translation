import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopicMatcher } from '../TopicMatcher';
import { RawArticle } from '../../types/news';

// Mock config
vi.mock('../../config', () => ({
  config: {
    news: {
      similarityThreshold: 0.75,
      openaiApiKey: '',
      embeddingModel: 'text-embedding-3-small',
    },
  },
}));

function makeArticle(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    id: 'art-1',
    sourceId: 'src-1',
    sourceName: 'Test Source',
    language: 'zh',
    title: '测试标题',
    summary: '测试摘要',
    content: '测试正文',
    url: 'https://example.com/article',
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    domain: 'tech',
    ...overrides,
  };
}

describe('TopicMatcher.generateTopicSummary', () => {
  let matcher: TopicMatcher;

  beforeEach(() => {
    matcher = new TopicMatcher(0.75);
    vi.restoreAllMocks();
  });

  it('should return fallback with both titles when API key is missing', async () => {
    const zh = makeArticle({ title: '中文新闻', language: 'zh' });
    const en = makeArticle({ title: 'English News', language: 'en' });

    const result = await matcher.generateTopicSummary(zh, en);
    expect(result).toBe('中文新闻 / English News');
  });

  it('should return zh title only for zh-only article', async () => {
    const zh = makeArticle({ title: '仅中文新闻', language: 'zh' });

    const result = await matcher.generateTopicSummary(zh, null);
    expect(result).toBe('仅中文新闻');
  });

  it('should return en title only for en-only article', async () => {
    const en = makeArticle({ title: 'English Only', language: 'en' });

    const result = await matcher.generateTopicSummary(null, en);
    expect(result).toBe('English Only');
  });

  it('should return "Untitled" when both articles are null', async () => {
    const result = await matcher.generateTopicSummary(null, null);
    expect(result).toBe('Untitled');
  });

  it('should always return a non-empty string', async () => {
    const zh = makeArticle({ title: '标题', language: 'zh' });
    const en = makeArticle({ title: 'Title', language: 'en' });

    // All combinations should produce non-empty strings
    const results = await Promise.all([
      matcher.generateTopicSummary(zh, en),
      matcher.generateTopicSummary(zh, null),
      matcher.generateTopicSummary(null, en),
      matcher.generateTopicSummary(null, null),
    ]);

    for (const r of results) {
      expect(r).toBeTruthy();
      expect(r.length).toBeGreaterThan(0);
    }
  });

  it('should fall back to title concatenation when API call fails', async () => {
    // Temporarily set API key via config mock
    const { config } = await import('../../config');
    (config.news as any).openaiApiKey = 'test-key';

    // Mock fetch to simulate failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const zh = makeArticle({ title: '网络错误测试', language: 'zh' });
    const en = makeArticle({ title: 'Network Error Test', language: 'en' });

    const result = await matcher.generateTopicSummary(zh, en);
    expect(result).toBe('网络错误测试 / Network Error Test');

    globalThis.fetch = originalFetch;
    (config.news as any).openaiApiKey = '';
  });

  it('should fall back when API returns non-ok status', async () => {
    const { config } = await import('../../config');
    (config.news as any).openaiApiKey = 'test-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const zh = makeArticle({ title: 'API错误', language: 'zh' });
    const result = await matcher.generateTopicSummary(zh, null);
    expect(result).toBe('API错误');

    globalThis.fetch = originalFetch;
    (config.news as any).openaiApiKey = '';
  });

  it('should use API response when available', async () => {
    const { config } = await import('../../config');
    (config.news as any).openaiApiKey = 'test-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'AI-generated summary about the event.',
            },
          },
        ],
      }),
    });

    const zh = makeArticle({ title: '人工智能新闻', summary: '关于AI的摘要', language: 'zh' });
    const en = makeArticle({ title: 'AI News', summary: 'Summary about AI', language: 'en' });

    const result = await matcher.generateTopicSummary(zh, en);
    expect(result).toBe('AI-generated summary about the event.');

    // Verify the API was called with correct model
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const callBody = JSON.parse(
      (globalThis.fetch as any).mock.calls[0][1].body,
    );
    expect(callBody.model).toBe(config.news.chatModel);
    expect(callBody.messages).toHaveLength(2);
    expect(callBody.messages[1].content).toContain('人工智能新闻');
    expect(callBody.messages[1].content).toContain('AI News');

    globalThis.fetch = originalFetch;
    (config.news as any).openaiApiKey = '';
  });

  it('should fall back when API returns empty content', async () => {
    const { config } = await import('../../config');
    (config.news as any).openaiApiKey = 'test-key';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '' } }],
      }),
    });

    const en = makeArticle({ title: 'Empty Response', language: 'en' });
    const result = await matcher.generateTopicSummary(null, en);
    expect(result).toBe('Empty Response');

    globalThis.fetch = originalFetch;
    (config.news as any).openaiApiKey = '';
  });
});

describe('TopicMatcher.keywordSimilarity', () => {
  let matcher: TopicMatcher;

  beforeEach(() => {
    matcher = new TopicMatcher(0.75);
    vi.restoreAllMocks();
  });

  it('should return a number between 0 and 1', () => {
    const a = makeArticle({ title: 'AI technology advances', summary: 'New AI model released', language: 'en' });
    const b = makeArticle({ title: 'AI breakthrough in tech', summary: 'Technology company releases AI', language: 'en' });

    const score = matcher.keywordSimilarity(a, b);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should return higher similarity for articles with shared English terms', () => {
    const a = makeArticle({ title: 'AI technology advances rapidly', summary: 'New AI model released by OpenAI', language: 'en' });
    const b = makeArticle({ title: 'AI technology breakthrough', summary: 'OpenAI releases new AI model', language: 'en' });
    const c = makeArticle({ title: 'Weather forecast sunny', summary: 'Rain expected tomorrow afternoon', language: 'en' });

    const similarScore = matcher.keywordSimilarity(a, b);
    const differentScore = matcher.keywordSimilarity(a, c);

    expect(similarScore).toBeGreaterThan(differentScore);
  });

  it('should handle Chinese text by splitting into characters', () => {
    const a = makeArticle({ title: '人工智能技术突破', summary: '新模型发布', language: 'zh' });
    const b = makeArticle({ title: '人工智能新进展', summary: '技术突破', language: 'zh' });

    const score = matcher.keywordSimilarity(a, b);
    expect(score).toBeGreaterThan(0);
  });

  it('should return 0 for articles with no shared terms', () => {
    const a = makeArticle({ title: 'abc def', summary: 'ghi jkl', language: 'en' });
    const b = makeArticle({ title: 'mno pqr', summary: 'stu vwx', language: 'en' });

    const score = matcher.keywordSimilarity(a, b);
    expect(score).toBe(0);
  });

  it('should return 0 when articles have empty title and summary', () => {
    const a = makeArticle({ title: '', summary: '', language: 'en' });
    const b = makeArticle({ title: '', summary: '', language: 'en' });

    const score = matcher.keywordSimilarity(a, b);
    expect(score).toBe(0);
  });
});

describe('TopicMatcher.matchArticles - embedding fallback', () => {
  let matcher: TopicMatcher;

  beforeEach(() => {
    matcher = new TopicMatcher(0.01); // very low threshold so keyword matches can pair
    vi.restoreAllMocks();
  });

  it('should fall back to keyword matching when embedding API fails', async () => {
    // getEmbedding will throw since no API key is configured (mock has empty key)
    const zhArticle = makeArticle({
      id: 'zh-1',
      title: 'AI technology breakthrough',
      summary: 'AI model released',
      language: 'zh',
      domain: 'ai',
    });
    const enArticle = makeArticle({
      id: 'en-1',
      title: 'AI technology breakthrough',
      summary: 'AI model released',
      language: 'en',
      domain: 'ai',
    });

    // matchArticles should not throw — it should fall back to keyword matching
    const results = await matcher.matchArticles([zhArticle, enArticle]);

    expect(results.length).toBeGreaterThan(0);
    // With identical titles/summaries and low threshold, they should pair
    const paired = results.find((r) => r.pairingStatus === 'paired');
    expect(paired).toBeDefined();
  });

  it('should still produce results for all articles when embedding fails', async () => {
    const articles = [
      makeArticle({ id: 'zh-1', title: '中文新闻', summary: '摘要', language: 'zh', domain: 'tech' }),
      makeArticle({ id: 'zh-2', title: '另一条中文', summary: '另一摘要', language: 'zh', domain: 'economy' }),
      makeArticle({ id: 'en-1', title: 'English news', summary: 'summary', language: 'en', domain: 'tech' }),
    ];

    const results = await matcher.matchArticles(articles);

    // Should have a result for each article (2 zh + 1 en, some may pair)
    // At minimum, all articles should be accounted for
    const zhCount = results.filter(
      (r) => r.pairingStatus === 'zh-only' || (r.pairingStatus === 'paired' && r.chineseArticle),
    ).length;
    const enCount = results.filter(
      (r) => r.pairingStatus === 'en-only' || (r.pairingStatus === 'paired' && r.englishArticle),
    ).length;

    expect(zhCount).toBe(2);
    expect(enCount).toBe(1);
  });
});
