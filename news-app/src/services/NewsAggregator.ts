import Parser from 'rss-parser';
import { randomUUID } from 'crypto';
import { NewsSource, RawArticle, AggregationResult, SourceError } from '../types';
import { SourceRegistryService } from './SourceRegistryService';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 15000;
const MAX_RETRIES = 1;

export class NewsAggregator {
  private parser: Parser;
  private sourceRegistry: SourceRegistryService;

  constructor(sourceRegistry: SourceRegistryService) {
    this.sourceRegistry = sourceRegistry;
    this.parser = new Parser({
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
      timeout: FETCH_TIMEOUT,
    });
  }

  async fetchArticles(since: Date): Promise<AggregationResult> {
    const sources = this.sourceRegistry.getSources();
    const allArticles: RawArticle[] = [];
    const errors: SourceError[] = [];

    // Fetch sources in parallel with concurrency limit of 8
    const concurrency = 8;
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (source) => {
          console.log(`  📡 抓取 ${source.name}...`);
          const articles = await this.fetchWithRetry(source, since);
          console.log(`     ✅ ${source.name}: ${articles.length} 篇`);
          return { source, articles };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value.articles);
        } else {
          // Extract source name from error context
          const batchIndex = results.indexOf(result);
          const source = batch[batchIndex];
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.log(`     ❌ ${source.name}: ${msg}`);
          errors.push({
            sourceId: source.id,
            sourceName: source.name,
            error: msg,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return { articles: allArticles, errors, fetchedAt: new Date().toISOString() };
  }

  private async fetchWithRetry(source: NewsSource, since: Date): Promise<RawArticle[]> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchFromSource(source, since);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          // Wait before retry (exponential backoff)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  private async fetchFromSource(source: NewsSource, since?: Date): Promise<RawArticle[]> {
    const feed = await this.parser.parseURL(source.url);

    const now = new Date();
    const articles: RawArticle[] = [];

    for (const item of feed.items) {
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      if (!publishedAt || isNaN(publishedAt.getTime())) continue;
      if (since && publishedAt < since) continue;
      if (publishedAt > now) continue;

      const url = item.link || '';
      const title = item.title || '';
      if (!url || !title) continue;

      articles.push({
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        language: source.language,
        title,
        summary: item.contentSnippet || item.content || '',
        content: item.content || item.contentSnippet || '',
        url,
        publishedAt: publishedAt.toISOString(),
        fetchedAt: now.toISOString(),
        domain: source.domain,
      });
    }
    return articles;
  }
}
