import cron, { ScheduledTask } from 'node-cron';
import { BriefingGenerator } from './BriefingGenerator';
import { BriefingUpdateResult } from '../types/briefing';

/** How long to wait before retrying a failed generation (in ms) */
const RETRY_DELAY_MS = 15 * 60 * 1000; // 15 minutes

/** Maximum number of retry attempts after a failure */
const MAX_RETRIES = 3;

export class BriefingScheduler {
  private generator: BriefingGenerator;
  private cronJob: ScheduledTask | null = null;
  private lastResult: BriefingUpdateResult | null = null;

  constructor(generator: BriefingGenerator) {
    this.generator = generator;
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
   * Trigger a single briefing generation and return the update result.
   */
  async triggerGeneration(): Promise<BriefingUpdateResult> {
    const briefing = await this.generator.generateDailyBriefing();
    this.lastResult = briefing.updateResult;
    return briefing.updateResult;
  }

  /**
   * Wrapper that retries `triggerGeneration` up to MAX_RETRIES times on failure,
   * waiting RETRY_DELAY_MS between each attempt.
   */
  async executeWithRetry(): Promise<BriefingUpdateResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.triggerGeneration();
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
    const failedResult: BriefingUpdateResult = {
      success: false,
      completedAt: new Date().toISOString(),
      articlesFetched: 0,
      entriesGenerated: 0,
      retryCount: MAX_RETRIES,
      errors: [lastError?.message ?? 'Unknown error after retries'],
    };

    this.lastResult = failedResult;
    return failedResult;
  }

  /** Returns the result of the most recent generation (or null if none yet). */
  getLastResult(): BriefingUpdateResult | null {
    return this.lastResult;
  }

  /** Promise-based delay helper (extracted for testability). */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
