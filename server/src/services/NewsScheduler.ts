import cron, { ScheduledTask } from 'node-cron';
import { NewsAggregator } from './NewsAggregator';
import { TopicMatcher } from './TopicMatcher';
import { NewsRanker } from './NewsRanker';
import { DailyNews, UpdateResult } from '../types/news';

/** How long to wait before retrying a failed update (in ms) */
const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 minutes

/** Maximum number of retry attempts after a failure */
const MAX_RETRIES = 3;

/** Default number of top news items to select */
const DEFAULT_TOP_COUNT = 10;

export type StorageCallback = (dailyNews: DailyNews) => Promise<void>;

export class NewsScheduler {
  private aggregator: NewsAggregator;
  private matcher: TopicMatcher;
  private ranker: NewsRanker;
  private storageCallback: StorageCallback;
  private cronJob: ScheduledTask | null = null;
  private lastResult: UpdateResult | null = null;

  constructor(
    aggregator: NewsAggregator,
    matcher: TopicMatcher,
    ranker: NewsRanker,
    storageCallback: StorageCallback,
  ) {
    this.aggregator = aggregator;
    this.matcher = matcher;
    this.ranker = ranker;
    this.storageCallback = storageCallback;
  }

  /**
   * Start the cron job — triggers every day at 09:00.
   */
  start(): void {
    if (this.cronJob) return;

    this.cronJob = cron.schedule('0 9 * * *', () => {
      this.executeWithRetry();
    });
  }

  /**
   * Stop the cron job.
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  /**
   * Execute the full news pipeline:
   *  1. Aggregate articles from the last 24 hours
   *  2. Match Chinese/English articles by topic
   *  3. Rank and select top 10
   *  4. Build DailyNews and persist via storage callback
   *
   * Returns an UpdateResult summarising the run.
   */
  async triggerUpdate(): Promise<UpdateResult> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Step 1 — Aggregate
    const aggregation = await this.aggregator.fetchArticles(since);

    // Step 2 — Match
    const matched = await this.matcher.matchArticles(aggregation.articles);

    // Step 3 — Rank & select
    const ranked = this.ranker.rankAndSelect(matched, DEFAULT_TOP_COUNT);

    // Step 4 — Build DailyNews
    const now = new Date();
    const result: UpdateResult = {
      success: true,
      completedAt: now.toISOString(),
      articlesFetched: aggregation.articles.length,
      newsItemsGenerated: ranked.length,
      retryCount: 0,
      errors: aggregation.errors.map((e) => `${e.sourceName}: ${e.error}`),
    };

    const dailyNews: DailyNews = {
      date: now.toISOString().slice(0, 10), // YYYY-MM-DD
      items: ranked,
      generatedAt: now.toISOString(),
      updateResult: result,
    };

    // Step 5 — Persist
    await this.storageCallback(dailyNews);

    this.lastResult = result;
    return result;
  }

  /**
   * Wrapper that retries `triggerUpdate` up to MAX_RETRIES times on failure,
   * waiting RETRY_DELAY_MS between each attempt.
   */
  async executeWithRetry(): Promise<UpdateResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.triggerUpdate();
        result.retryCount = attempt;
        this.lastResult = result;
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't wait after the last allowed attempt
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS);
        }
      }
    }

    // All retries exhausted
    const failedResult: UpdateResult = {
      success: false,
      completedAt: new Date().toISOString(),
      articlesFetched: 0,
      newsItemsGenerated: 0,
      retryCount: MAX_RETRIES,
      errors: [lastError?.message ?? 'Unknown error after retries'],
    };

    this.lastResult = failedResult;
    return failedResult;
  }

  /** Returns the result of the most recent update (or null if none yet). */
  getLastResult(): UpdateResult | null {
    return this.lastResult;
  }

  /** Promise-based delay helper (extracted for testability). */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
