import Parser from 'rss-parser';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import { randomUUID } from 'crypto';
import {
  BriefingDomain,
  BriefingSource,
  BriefingSourceRegistry,
  DailyBriefing,
  BriefingUpdateResult,
  NewsEntry,
} from '../types/briefing';
import { ContentExtractor } from './ContentExtractor';
import { TranslationService } from './TranslationService';
import { BriefingStorageService } from './BriefingStorageService';

/** Internal article representation used during briefing generation */
export interface BriefingRawArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  domain: BriefingDomain;
  /** Source tier weight used for importance scoring */
  weight: number;
}

const SOURCE_TIMEOUT_MS = 30_000;
const DEFAULT_COUNT_PER_DOMAIN = 3;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class BriefingGenerator {
  private parser: Parser;
  private contentExtractor: ContentExtractor;
  private translationService: TranslationService;
  private storageService: BriefingStorageService;
  private sources: BriefingSource[];

  constructor(
    contentExtractor: ContentExtractor,
    translationService: TranslationService,
    storageService: BriefingStorageService,
    sourcesPath?: string,
  ) {
    this.parser = new Parser();
    this.contentExtractor = contentExtractor;
    this.translationService = translationService;
    this.storageService = storageService;
    this.sources = this.loadSources(sourcesPath);
  }

  private loadSources(sourcesPath?: string): BriefingSource[] {
    const filePath = sourcesPath || this.resolveSourcesPath();
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const registry = JSON.parse(content) as BriefingSourceRegistry;
      return registry.sources.filter((s) => s.enabled);
    } catch (err) {
      console.warn(`⚠️ 无法加载 briefingSources.json (${filePath})，使用空来源列表`);
      return [];
    }
  }

  private resolveSourcesPath(): string {
    const candidates = [
      path.join(__dirname, '..', 'data', 'briefingSources.json'),
      path.join(__dirname, '..', '..', 'src', 'data', 'briefingSources.json'),
      path.join(process.cwd(), 'src', 'data', 'briefingSources.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
  }

  /**
   * Generate the daily briefing for a given date (defaults to today).
   */
  async generateDailyBriefing(date?: string): Promise<DailyBriefing> {
    const briefingDate = date || new Date().toISOString().slice(0, 10);
    const errors: string[] = [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const allArticles: BriefingRawArticle[] = [];
    for (const source of this.sources) {
      try {
        console.log(`[BriefingGenerator] 正在抓取: ${source.name} (${source.type})`);
        const articles = await this.fetchFromSource(source, since);
        console.log(`[BriefingGenerator] ${source.name}: 获取 ${articles.length} 篇文章`);
        allArticles.push(...articles);
      } catch (err) {
        const msg = `Source ${source.name} (${source.id}) failed: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[BriefingGenerator] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[BriefingGenerator] 共获取 ${allArticles.length} 篇文章`);

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueArticles = allArticles.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    console.log(`[BriefingGenerator] 去重后 ${uniqueArticles.length} 篇文章`);

    const topByDomain = this.selectTopArticles(uniqueArticles, DEFAULT_COUNT_PER_DOMAIN);

    const selectedArticles: BriefingRawArticle[] = [];
    for (const articles of topByDomain.values()) {
      selectedArticles.push(...articles);
    }

    console.log(`[BriefingGenerator] 选取 ${selectedArticles.length} 篇文章进行内容提取`);

    // Enrich with full content
    const enrichedArticles = await this.enrichWithFullContent(selectedArticles);

    // Translate titles
    const chineseTitles = enrichedArticles.map((a) => a.title);
    let englishTitles: string[];
    try {
      englishTitles = await this.translationService.translateTitles(chineseTitles);
    } catch (err) {
      console.error('[BriefingGenerator] Translation failed:', err);
      englishTitles = [...chineseTitles];
      errors.push(`Translation failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const entries: NewsEntry[] = enrichedArticles.map((article, i) => ({
      id: randomUUID(),
      domain: article.domain,
      chineseTitle: article.title,
      englishTitle: englishTitles[i] || article.title,
      summary: article.summary,
      content: article.content,
      sourceUrl: article.url,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
    }));

    const now = new Date().toISOString();
    const updateResult: BriefingUpdateResult = {
      success: true,
      completedAt: now,
      articlesFetched: allArticles.length,
      entriesGenerated: entries.length,
      retryCount: 0,
      errors,
    };

    const briefing: DailyBriefing = {
      date: briefingDate,
      entries,
      generatedAt: now,
      updateResult,
    };

    await this.storageService.saveDailyBriefing(briefing);
    console.log(`[BriefingGenerator] 简报已保存: ${entries.length} 条新闻`);
    return briefing;
  }

  /**
   * Dispatch to the correct fetch strategy based on source.type
   */
  private async fetchFromSource(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    return Promise.race([
      this.fetchByType(source, since),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Source ${source.name} timed out after 30s`)),
          SOURCE_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  private async fetchByType(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    switch (source.type) {
      case 'rss':
        return this.fetchRss(source, since);
      case 'thepaper-api':
        return this.fetchThePaper(source, since);
      case 'wallstreetcn-api':
        return this.fetchWallStreetCN(source, since);
      case 'huanqiu-scrape':
        return this.fetchHuanqiu(source, since);
      default:
        console.warn(`[BriefingGenerator] Unknown source type: ${source.type}`);
        return [];
    }
  }

  // ─── RSS (36氪) ───────────────────────────────────────────────

  private async fetchRss(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    const feed = await this.parser.parseURL(source.url);
    const now = new Date();
    const articles: BriefingRawArticle[] = [];

    for (const item of feed.items) {
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      if (!publishedAt || isNaN(publishedAt.getTime())) continue;
      if (publishedAt < since || publishedAt > now) continue;

      const url = item.link || '';
      const title = item.title || '';
      if (!url || !title) continue;

      articles.push({
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        title,
        summary: item.contentSnippet || item.content || '',
        content: item.content || item.contentSnippet || '',
        url,
        publishedAt: publishedAt.toISOString(),
        fetchedAt: now.toISOString(),
        domain: source.domain,
        weight: source.weight,
      });
    }

    return articles;
  }

  // ─── 澎湃新闻 API ────────────────────────────────────────────

  private async fetchThePaper(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    const response = await fetch(source.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.thepaper.cn/',
        'Origin': 'https://www.thepaper.cn',
      },
      body: JSON.stringify({ channelId: 25950, pageNum: 1, pageSize: 15 }),
    });

    if (!response.ok) {
      throw new Error(`澎湃 API HTTP ${response.status}`);
    }

    const json = await response.json() as {
      data?: {
        list?: Array<{
          contId?: string | number;
          name?: string;
          pubTime?: string;
          summary?: string;
        }>;
      };
    };

    const list = json.data?.list || [];
    const now = new Date();
    const articles: BriefingRawArticle[] = [];

    for (const item of list) {
      const title = item.name || '';
      const contId = item.contId;
      if (!title || !contId) continue;

      // pubTime can be relative ("刚刚", "X分钟前", "X小时前") or a date string
      const publishedAt = this.parseThePaperTime(item.pubTime, now);
      if (publishedAt && publishedAt < since) continue;

      const url = `https://www.thepaper.cn/newsDetail_forward_${contId}`;

      articles.push({
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        title,
        summary: item.summary || '',
        content: '',
        url,
        publishedAt: publishedAt?.toISOString() || now.toISOString(),
        fetchedAt: now.toISOString(),
        domain: source.domain,
        weight: source.weight,
      });
    }

    return articles;
  }

  // ─── 华尔街见闻 API ──────────────────────────────────────────

  private async fetchWallStreetCN(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    const response = await fetch(source.url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`华尔街见闻 API HTTP ${response.status}`);
    }

    const json = await response.json() as {
      data?: {
        items?: Array<{
          title?: string;
          uri?: string;
          display_time?: number;
          content_short?: string;
        }>;
      };
    };

    const items = json.data?.items || [];
    const now = new Date();
    const articles: BriefingRawArticle[] = [];

    for (const item of items) {
      const title = item.title || '';
      const uri = item.uri || '';
      if (!title || !uri) continue;

      const publishedAt = item.display_time
        ? new Date(item.display_time * 1000)
        : null;
      if (publishedAt && publishedAt < since) continue;

      // uri may be a full URL or just an ID
      const url = uri.startsWith('http')
        ? uri
        : `https://wallstreetcn.com/articles/${uri}`;

      articles.push({
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        title,
        summary: item.content_short || '',
        content: '',
        url,
        publishedAt: publishedAt?.toISOString() || now.toISOString(),
        fetchedAt: now.toISOString(),
        domain: source.domain,
        weight: source.weight,
      });
    }

    return articles;
  }

  // ─── 环球网 (mobile site scrape) ─────────────────────────────

  private async fetchHuanqiu(
    source: BriefingSource,
    since: Date,
  ): Promise<BriefingRawArticle[]> {
    // Try the mobile world news page which is lighter and more scrapable
    const urls = [
      'https://m.huanqiu.com/api/list?node=%22/e3pmh22ph/e3pmh26vv%22&offset=0&limit=15',
      'https://m.huanqiu.com/api/list?node=%22/e3pmh22ph/e3pmt7jcl%22&offset=0&limit=15',
    ];

    const now = new Date();
    const articles: BriefingRawArticle[] = [];

    for (const apiUrl of urls) {
      try {
        const response = await fetch(apiUrl, {
          headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) continue;

        const json = await response.json() as {
          list?: Array<{
            title?: string;
            aid?: string;
            ctime?: string | number;
            summary?: string;
          }>;
        };

        const list = json.list || [];

        for (const item of list) {
          const title = item.title || '';
          const aid = item.aid || '';
          if (!title || !aid) continue;

          const publishedAt = item.ctime
            ? new Date(typeof item.ctime === 'string' ? parseInt(item.ctime, 10) : item.ctime)
            : null;
          if (publishedAt && isNaN(publishedAt.getTime())) continue;
          if (publishedAt && publishedAt < since) continue;

          const url = `https://m.huanqiu.com/article/${aid}`;

          articles.push({
            id: randomUUID(),
            sourceId: source.id,
            sourceName: source.name,
            title,
            summary: item.summary || '',
            content: '',
            url,
            publishedAt: publishedAt?.toISOString() || now.toISOString(),
            fetchedAt: now.toISOString(),
            domain: source.domain,
            weight: source.weight,
          });
        }
      } catch (err) {
        console.warn(`[BriefingGenerator] 环球网 API ${apiUrl} failed:`, err instanceof Error ? err.message : err);
      }
    }

    // Fallback: scrape mobile homepage if API returned nothing
    if (articles.length === 0) {
      try {
        const response = await fetch('https://m.huanqiu.com', {
          headers: { 'User-Agent': USER_AGENT },
        });
        if (response.ok) {
          const html = await response.text();
          const dom = new JSDOM(html);
          const links = dom.window.document.querySelectorAll('a[href*="/article/"]');

          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).getAttribute('href') || '';
            const title = (link as HTMLElement).textContent?.trim() || '';
            if (!title || title.length < 5 || !href) return;

            const fullUrl = href.startsWith('http') ? href : `https://m.huanqiu.com${href}`;

            articles.push({
              id: randomUUID(),
              sourceId: source.id,
              sourceName: source.name,
              title,
              summary: '',
              content: '',
              url: fullUrl,
              publishedAt: now.toISOString(),
              fetchedAt: now.toISOString(),
              domain: source.domain,
              weight: source.weight,
            });
          });
        }
      } catch (err) {
        console.warn('[BriefingGenerator] 环球网 fallback scrape failed:', err instanceof Error ? err.message : err);
      }
    }

    return articles;
  }

  // ─── Shared logic ─────────────────────────────────────────────

  /**
   * Parse 澎湃新闻 relative time strings like "刚刚", "X分钟前", "X小时前", "昨天 HH:mm"
   */
  private parseThePaperTime(pubTime: string | undefined, now: Date): Date | null {
    if (!pubTime) return null;

    if (pubTime === '刚刚') return now;

    const minutesMatch = pubTime.match(/(\d+)\s*分钟前/);
    if (minutesMatch) {
      return new Date(now.getTime() - parseInt(minutesMatch[1], 10) * 60 * 1000);
    }

    const hoursMatch = pubTime.match(/(\d+)\s*小时前/);
    if (hoursMatch) {
      return new Date(now.getTime() - parseInt(hoursMatch[1], 10) * 60 * 60 * 1000);
    }

    // Try parsing as a regular date
    const parsed = new Date(pubTime);
    if (!isNaN(parsed.getTime())) return parsed;

    // If we can't parse it, treat as "now" (it's likely recent)
    return now;
  }

  selectTopArticles(
    articles: BriefingRawArticle[],
    countPerDomain: number,
  ): Map<BriefingDomain, BriefingRawArticle[]> {
    const grouped = new Map<BriefingDomain, BriefingRawArticle[]>();

    for (const article of articles) {
      const list = grouped.get(article.domain) || [];
      list.push(article);
      grouped.set(article.domain, list);
    }

    const result = new Map<BriefingDomain, BriefingRawArticle[]>();
    for (const [domain, domainArticles] of grouped) {
      const sorted = domainArticles.sort(
        (a, b) => this.computeImportanceScore(b) - this.computeImportanceScore(a),
      );
      result.set(domain, sorted.slice(0, countPerDomain));
    }

    return result;
  }

  private computeImportanceScore(article: BriefingRawArticle): number {
    const now = Date.now();
    const publishedMs = new Date(article.publishedAt).getTime();
    const ageMs = now - publishedMs;
    const maxAgeMs = 24 * 60 * 60 * 1000;
    const recencyFactor = Math.max(0, 1 - ageMs / maxAgeMs);
    return article.weight * recencyFactor;
  }

  async enrichWithFullContent(
    articles: BriefingRawArticle[],
  ): Promise<BriefingRawArticle[]> {
    const enriched: BriefingRawArticle[] = [];

    for (const article of articles) {
      try {
        const extracted = await this.contentExtractor.extractFromUrl(article.url);
        enriched.push({
          ...article,
          content: extracted.content || article.content,
        });
      } catch (err) {
        console.warn(
          `[BriefingGenerator] Content extraction failed for ${article.url}: ${err instanceof Error ? err.message : String(err)}`,
        );
        enriched.push(article);
      }
    }

    return enriched;
  }
}
