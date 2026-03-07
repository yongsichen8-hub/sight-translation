import Parser from 'rss-parser';
import { randomUUID } from 'crypto';
import {
  NewsSource,
  RawArticle,
  AggregationResult,
  SourceError,
} from '../types/news';
import { SourceRegistryService } from './SourceRegistryService';

export class NewsAggregator {
  private parser: Parser;
  private sourceRegistry: SourceRegistryService;

  constructor(sourceRegistry: SourceRegistryService) {
    this.sourceRegistry = sourceRegistry;
    this.parser = new Parser();
  }

  private static readonly SOURCE_TIMEOUT_MS = 30_000;

  /**
   * Fetch articles from all enabled sources published since the given date.
   * Tolerates individual source failures — each source that is unreachable or
   * times out is skipped with a SourceError; remaining sources are still fetched.
   */
  async fetchArticles(since: Date): Promise<AggregationResult> {
    const sources = this.sourceRegistry.getSources();
    const allArticles: RawArticle[] = [];
    const errors: SourceError[] = [];

    for (const source of sources) {
      try {
        const articles = await this.fetchFromSourceWithTimeout(source, since);
        allArticles.push(...articles);
      } catch (err) {
        errors.push({
          sourceId: source.id,
          sourceName: source.name,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      articles: allArticles,
      errors,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Wraps fetchFromSource with a 30-second timeout.
   * If the source does not respond within the timeout, a timeout error is thrown
   * and caught by the caller so the aggregation continues with other sources.
   */
  private async fetchFromSourceWithTimeout(
    source: NewsSource,
    since?: Date,
  ): Promise<RawArticle[]> {
    return Promise.race([
      this.fetchFromSource(source, since),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Source ${source.name} timed out after 30s`)),
          NewsAggregator.SOURCE_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  /**
   * Fetch and parse articles from a single RSS source.
   * Filters articles by publishedAt >= since.
   */
  async fetchFromSource(source: NewsSource, since?: Date): Promise<RawArticle[]> {
    const feed = await this.parser.parseURL(source.url);
    const now = new Date();
    const articles: RawArticle[] = [];

    for (const item of feed.items) {
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;

      // Skip items without a valid publish date
      if (!publishedAt || isNaN(publishedAt.getTime())) {
        continue;
      }

      // Filter by time window [since, now] — strict both bounds
      if (since && publishedAt < since) {
        continue;
      }
      if (publishedAt > now) {
        continue;
      }

      const url = item.link || '';
      const title = item.title || '';
      const summary = item.contentSnippet || item.content || '';
      const content = item.content || item.contentSnippet || '';

      // Ensure required fields are non-empty
      if (!url || !title) {
        continue;
      }

      articles.push({
        id: randomUUID(),
        sourceId: source.id,
        sourceName: source.name,
        language: source.language,
        title,
        summary,
        content,
        url,
        publishedAt: publishedAt.toISOString(),
        fetchedAt: now.toISOString(),
        domain: source.domain,
      });
    }

    return articles;
  }
}
