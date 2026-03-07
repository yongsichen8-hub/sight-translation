import { randomUUID } from 'crypto';
import { RawArticle, NewsItem, ArticleRef } from '../types/news';
import { config } from '../config';

export class TopicMatcher {
  private similarityThreshold: number;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(similarityThreshold?: number) {
    this.similarityThreshold =
      similarityThreshold ?? config.news.similarityThreshold;
  }

  /**
   * Call OpenAI Embeddings API to get a vector for the given text.
   */
  async getEmbedding(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) return cached;

    const apiKey = config.news.openaiApiKey;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const baseUrl = config.news.openaiBaseUrl;
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: config.news.embeddingModel,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI Embeddings API error (${response.status}): ${body}`,
      );
    }

    const data = (await response.json()) as {
      data: { embedding: number[] }[];
    };
    const embedding = data.data[0].embedding;
    this.embeddingCache.set(text, embedding);
    return embedding;
  }

  /**
   * Build the embedding text for an article (title + summary).
   */
  private buildEmbeddingText(article: RawArticle): string {
    return `${article.title} ${article.summary}`.trim();
  }

  /**
   * Extract keywords/terms from text.
   * For Chinese text, splits by common delimiters and individual characters.
   * For English text, splits by spaces and lowercases.
   */
  private extractTerms(text: string): Set<string> {
    const terms = new Set<string>();
    if (!text) return terms;

    // Split by whitespace, punctuation, and common delimiters
    const tokens = text.split(/[\s,.\-;:!?，。；：！？、""''（）()\[\]【】《》\n\r\t]+/);

    for (const token of tokens) {
      if (!token) continue;

      // Check if token contains CJK characters
      if (/[\u4e00-\u9fff]/.test(token)) {
        // For Chinese: add the whole token and also individual characters
        if (token.length >= 2) {
          terms.add(token);
        }
        for (const ch of token) {
          if (/[\u4e00-\u9fff]/.test(ch)) {
            terms.add(ch);
          }
        }
      } else {
        // For English: lowercase and filter very short tokens
        const lower = token.toLowerCase();
        if (lower.length >= 2) {
          terms.add(lower);
        }
      }
    }

    return terms;
  }

  /**
   * Compute keyword-based similarity between two articles using Jaccard similarity
   * on terms extracted from titles and summaries.
   * Used as a fallback when the Embedding API is unavailable.
   */
  keywordSimilarity(articleA: RawArticle, articleB: RawArticle): number {
    const textA = `${articleA.title} ${articleA.summary}`.trim();
    const textB = `${articleB.title} ${articleB.summary}`.trim();

    const termsA = this.extractTerms(textA);
    const termsB = this.extractTerms(textB);

    if (termsA.size === 0 || termsB.size === 0) return 0;

    let intersection = 0;
    for (const term of termsA) {
      if (termsB.has(term)) {
        intersection++;
      }
    }

    // Jaccard similarity: |A ∩ B| / |A ∪ B|
    const union = termsA.size + termsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Compute semantic similarity between two articles using embeddings.
   */
  async computeSimilarity(
    articleA: RawArticle,
    articleB: RawArticle,
  ): Promise<number> {
    const [embA, embB] = await Promise.all([
      this.getEmbedding(this.buildEmbeddingText(articleA)),
      this.getEmbedding(this.buildEmbeddingText(articleB)),
    ]);
    return this.cosineSimilarity(embA, embB);
  }

  /**
   * Convert a RawArticle into an ArticleRef.
   */
  private toArticleRef(article: RawArticle): ArticleRef {
    return {
      articleId: article.id,
      sourceId: article.sourceId,
      sourceName: article.sourceName,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      publishedAt: article.publishedAt,
    };
  }

  /**
   * Generate a concise bilingual topic summary for a paired NewsItem
   * using OpenAI Chat Completions API (gpt-4o-mini).
   * Falls back to title concatenation if the API call fails.
   */
  async generateTopicSummary(
    chArticle: RawArticle | null,
    enArticle: RawArticle | null,
  ): Promise<string> {
    // Build fallback from titles
    const fallbackParts: string[] = [];
    if (chArticle) fallbackParts.push(chArticle.title);
    if (enArticle) fallbackParts.push(enArticle.title);
    const fallback = fallbackParts.join(' / ') || 'Untitled';

    // Build context from available articles
    const contextParts: string[] = [];
    if (chArticle) {
      contextParts.push(`中文标题: ${chArticle.title}`);
      if (chArticle.summary) contextParts.push(`中文摘要: ${chArticle.summary}`);
    }
    if (enArticle) {
      contextParts.push(`English title: ${enArticle.title}`);
      if (enArticle.summary) contextParts.push(`English summary: ${enArticle.summary}`);
    }

    if (contextParts.length === 0) return fallback;

    const apiKey = config.news.openaiApiKey;
    if (!apiKey) return fallback;

    try {
      const baseUrl = config.news.openaiBaseUrl;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.news.chatModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a bilingual news editor. Given article information, produce a brief 1-2 sentence topic summary that captures the core event. The summary should be bilingual (Chinese + English) when both languages are available, or in the single available language otherwise. Output ONLY the summary text, nothing else.',
            },
            {
              role: 'user',
              content: contextParts.join('\n'),
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });

      if (!response.ok) return fallback;

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };

      const summary = data.choices?.[0]?.message?.content?.trim();
      return summary || fallback;
    } catch {
      return fallback;
    }
  }


  /**
   * Match articles across languages using semantic similarity.
   *
   * Strategy: greedy matching — for each Chinese article, find the best
   * matching English article above the similarity threshold. Once an English
   * article is matched, it is removed from the candidate pool.
   *
   * Unmatched articles become 'zh-only' or 'en-only' items.
   */
  async matchArticles(articles: RawArticle[]): Promise<NewsItem[]> {
    const zhArticles = articles.filter((a) => a.language === 'zh');
    const enArticles = articles.filter((a) => a.language === 'en');

    // Try embedding-based matching first, fall back to keyword-based on failure
    let useKeywordFallback = false;

    try {
      // Pre-compute embeddings for all articles in parallel
      await Promise.all(
        articles.map((a) => this.getEmbedding(this.buildEmbeddingText(a))),
      );
    } catch {
      // Embedding API unavailable — switch to keyword-based fallback
      useKeywordFallback = true;
    }

    const matchedEnIds = new Set<string>();
    const results: NewsItem[] = [];

    // Greedy matching: for each zh article, find best en match
    for (const zhArticle of zhArticles) {
      let bestMatch: RawArticle | null = null;
      let bestScore = -1;

      for (const enArticle of enArticles) {
        if (matchedEnIds.has(enArticle.id)) continue;

        let score: number;
        if (useKeywordFallback) {
          score = this.keywordSimilarity(zhArticle, enArticle);
        } else {
          try {
            score = await this.computeSimilarity(zhArticle, enArticle);
          } catch {
            // Individual similarity call failed — fall back for remaining
            useKeywordFallback = true;
            score = this.keywordSimilarity(zhArticle, enArticle);
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = enArticle;
        }
      }

      if (bestMatch && bestScore >= this.similarityThreshold) {
        matchedEnIds.add(bestMatch.id);
        const summary = await this.generateTopicSummary(zhArticle, bestMatch);
        results.push({
          id: randomUUID(),
          topicSummary: summary,
          domain: zhArticle.domain,
          secondaryDomains:
            zhArticle.domain !== bestMatch.domain
              ? [bestMatch.domain]
              : [],
          chineseArticle: this.toArticleRef(zhArticle),
          englishArticle: this.toArticleRef(bestMatch),
          pairingStatus: 'paired',
          importanceScore: 0,
          rank: 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        // No match above threshold — zh-only
        const summary = await this.generateTopicSummary(zhArticle, null);
        results.push({
          id: randomUUID(),
          topicSummary: summary,
          domain: zhArticle.domain,
          secondaryDomains: [],
          chineseArticle: this.toArticleRef(zhArticle),
          englishArticle: null,
          pairingStatus: 'zh-only',
          importanceScore: 0,
          rank: 0,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Remaining unmatched English articles → en-only
    for (const enArticle of enArticles) {
      if (matchedEnIds.has(enArticle.id)) continue;

      const summary = await this.generateTopicSummary(null, enArticle);
      results.push({
        id: randomUUID(),
        topicSummary: summary,
        domain: enArticle.domain,
        secondaryDomains: [],
        chineseArticle: null,
        englishArticle: this.toArticleRef(enArticle),
        pairingStatus: 'en-only',
        importanceScore: 0,
        rank: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return results;
  }
}
