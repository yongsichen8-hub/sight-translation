import { NewsItem, NewsDomain } from '../types/news';
import { SourceRegistryService } from './SourceRegistryService';

/**
 * Scoring weights for importance calculation.
 * Each factor contributes a weighted portion to the final [0, 1] score.
 */
const WEIGHTS = {
  mediaWeight: 0.4,
  pairingBonus: 0.25,
  recency: 0.35,
};

/** Half-life for recency decay in hours — articles lose half their recency score after this many hours */
const RECENCY_HALF_LIFE_HOURS = 12;

/** The four domains the platform covers */
const ALL_DOMAINS: NewsDomain[] = ['ai', 'tech', 'economy', 'politics'];

export class NewsRanker {
  private sourceRegistry: SourceRegistryService;

  constructor(sourceRegistry: SourceRegistryService) {
    this.sourceRegistry = sourceRegistry;
  }

  /**
   * Compute an importance score in [0, 1] for a single NewsItem.
   *
   * Factors:
   * - Media weight: average weight of the sources involved (T1 sources have higher weight)
   * - Pairing bonus: paired items (covered by both zh and en media) get a boost
   * - Recency: exponential decay based on article age
   */
  computeImportanceScore(item: NewsItem): number {
    const mediaScore = this.computeMediaScore(item);
    const pairingScore = item.pairingStatus === 'paired' ? 1.0 : 0.0;
    const recencyScore = this.computeRecencyScore(item);

    const score =
      WEIGHTS.mediaWeight * mediaScore +
      WEIGHTS.pairingBonus * pairingScore +
      WEIGHTS.recency * recencyScore;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Sort items by importanceScore descending, take top `targetCount`,
   * ensure domain coverage, and assign rank (1-based) on each returned item.
   */
  rankAndSelect(items: NewsItem[], targetCount: number): NewsItem[] {
    // Score all items
    const scored = items.map((item) => ({
      ...item,
      importanceScore: this.computeImportanceScore(item),
    }));

    // Sort descending by importanceScore
    scored.sort((a, b) => b.importanceScore - a.importanceScore);

    // Take top targetCount
    const selected = scored.slice(0, targetCount);

    // Ensure domain coverage, passing the full scored pool for replacements
    const covered = this.ensureDomainCoverage(selected, 3, scored, targetCount);

    // Assign 1-based rank
    return covered.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  /**
   * Ensure the selected items cover at least `minDomains` different domains.
   *
   * If the current selection doesn't have enough domain diversity, swap out
   * the lowest-ranked items with the highest-scored items from missing domains
   * (sourced from the full candidate pool). The output length stays at
   * `targetCount` (or fewer if not enough candidates overall).
   */
  ensureDomainCoverage(
    ranked: NewsItem[],
    minDomains: number,
    candidatePool: NewsItem[],
    targetCount: number,
  ): NewsItem[] {
    if (ranked.length === 0) return [];

    // Determine which domains are currently covered
    const coveredDomains = new Set(ranked.map((item) => item.domain));

    // If we already meet the minimum, nothing to do
    if (coveredDomains.size >= minDomains) return ranked;

    // Find domains that are missing from the current selection
    const missingDomains = ALL_DOMAINS.filter((d) => !coveredDomains.has(d));

    // Collect the selected item IDs so we can avoid duplicates
    const selectedIds = new Set(ranked.map((item) => item.id));

    // For each missing domain, find the best candidate from the pool
    // (candidatePool is already sorted by importanceScore descending)
    const replacements: NewsItem[] = [];
    for (const domain of missingDomains) {
      const candidate = candidatePool.find(
        (item) => item.domain === domain && !selectedIds.has(item.id),
      );
      if (candidate) {
        replacements.push(candidate);
        selectedIds.add(candidate.id);
      }
    }

    if (replacements.length === 0) return ranked;

    // Swap out the lowest-ranked items (end of the list) with replacements.
    // Work on a copy so we don't mutate the input.
    const result = [...ranked];

    for (const replacement of replacements) {
      if (result.length < targetCount) {
        // There's room — just append
        result.push(replacement);
      } else {
        // Replace the lowest-scored item that isn't the sole representative
        // of its domain. Walk from the end to find a safe swap target.
        let swapped = false;
        for (let i = result.length - 1; i >= 0; i--) {
          const victim = result[i];
          // Count how many items share this victim's domain
          const domainCount = result.filter((r) => r.domain === victim.domain).length;
          if (domainCount > 1) {
            // Safe to remove — the domain still has representation
            result.splice(i, 1, replacement);
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          // All remaining items are sole domain representatives.
          // Replace the absolute lowest-scored item as a last resort.
          result[result.length - 1] = replacement;
        }
      }
    }

    // Re-sort by importanceScore descending after swaps
    result.sort((a, b) => b.importanceScore - a.importanceScore);

    return result;
  }

  /**
   * Compute media weight score based on source registry weights.
   * For paired items, averages the weights of both sources.
   * Falls back to a default mid-range weight if source is not found.
   */
  private computeMediaScore(item: NewsItem): number {
    const weights: number[] = [];

    if (item.chineseArticle) {
      const source = this.sourceRegistry.getSourceById(item.chineseArticle.sourceId);
      weights.push(source ? source.weight : 0.5);
    }

    if (item.englishArticle) {
      const source = this.sourceRegistry.getSourceById(item.englishArticle.sourceId);
      weights.push(source ? source.weight : 0.5);
    }

    if (weights.length === 0) return 0;
    return weights.reduce((sum, w) => sum + w, 0) / weights.length;
  }

  /**
   * Compute recency score using exponential decay.
   * Returns 1.0 for brand-new articles, decaying toward 0 over time.
   */
  private computeRecencyScore(item: NewsItem): number {
    const now = Date.now();
    const publishedTimes: number[] = [];

    if (item.chineseArticle) {
      const t = Date.parse(item.chineseArticle.publishedAt);
      if (!isNaN(t)) publishedTimes.push(t);
    }

    if (item.englishArticle) {
      const t = Date.parse(item.englishArticle.publishedAt);
      if (!isNaN(t)) publishedTimes.push(t);
    }

    if (publishedTimes.length === 0) return 0;

    // Use the most recent publication time
    const mostRecent = Math.max(...publishedTimes);
    const ageHours = Math.max(0, (now - mostRecent) / (1000 * 60 * 60));

    // Exponential decay: score = 2^(-age / halfLife)
    return Math.pow(2, -ageHours / RECENCY_HALF_LIFE_HOURS);
  }
}
