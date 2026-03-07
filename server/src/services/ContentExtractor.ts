import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { ExtractedContent } from '../types/briefing';

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class ContentExtractorError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ContentExtractorError';
    this.code = code;
  }
}

export class ContentExtractor {
  /**
   * Fetch a URL and extract the main article content using Readability.
   * Works for both Chinese and English pages.
   */
  async extractFromUrl(url: string): Promise<ExtractedContent> {
    const html = await this.fetchHtml(url);
    return this.parseContent(html, url);
  }

  private async fetchHtml(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ContentExtractorError(
          `Failed to fetch URL: ${url} (HTTP ${response.status})`,
          'URL_UNREACHABLE',
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof ContentExtractorError) throw error;

      const message =
        error instanceof Error ? error.message : 'Unknown fetch error';
      throw new ContentExtractorError(
        `Cannot access URL: ${url} – ${message}`,
        'URL_UNREACHABLE',
      );
    }
  }

  private parseContent(html: string, url: string): ExtractedContent {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent?.trim()) {
      throw new ContentExtractorError(
        `Failed to extract article content from: ${url}`,
        'EXTRACTION_FAILED',
      );
    }

    return {
      title: article.title ?? '',
      content: article.textContent.trim(),
      htmlContent: article.content ?? '',
      siteName: article.siteName ?? '',
      excerpt: article.excerpt ?? '',
    };
  }
}
