import { NewsItem, NewsDomain } from '../types';
import { SourceRegistryService } from './SourceRegistryService';

const WEIGHTS = { mediaWeight: 0.4, pairingBonus: 0.25, recency: 0.35 };
const RECENCY_HALF_LIFE_HOURS = 12;
const ALL_DOMAINS: NewsDomain[] = ['ai-tech', 'finance', 'geopolitics', 'automotive'];
const PER_DOMAIN_MIN = 5;
const PER_DOMAIN_MAX = 10;

export class NewsRanker {
  private sourceRegistry: SourceRegistryService;
  constructor(sourceRegistry: SourceRegistryService) { this.sourceRegistry = sourceRegistry; }

  computeImportanceScore(item: NewsItem): number {
    const weights: number[] = [];
    if (item.chineseArticle) { const s = this.sourceRegistry.getSourceById(item.chineseArticle.sourceId); weights.push(s ? s.weight : 0.5); }
    if (item.englishArticle) { const s = this.sourceRegistry.getSourceById(item.englishArticle.sourceId); weights.push(s ? s.weight : 0.5); }
    const mediaScore = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
    const pairingScore = item.pairingStatus === 'paired' ? 1.0 : 0.0;

    const times: number[] = [];
    if (item.chineseArticle) { const t = Date.parse(item.chineseArticle.publishedAt); if (!isNaN(t)) times.push(t); }
    if (item.englishArticle) { const t = Date.parse(item.englishArticle.publishedAt); if (!isNaN(t)) times.push(t); }
    const recencyScore = times.length ? Math.pow(2, -Math.max(0, (Date.now() - Math.max(...times)) / 3600000) / RECENCY_HALF_LIFE_HOURS) : 0;

    return Math.max(0, Math.min(1, WEIGHTS.mediaWeight * mediaScore + WEIGHTS.pairingBonus * pairingScore + WEIGHTS.recency * recencyScore));
  }

  /**
   * Only keep paired items (both zh + en sources), sort by importance.
   * TopicMatcher already limits to ~5 per domain, so we just filter and sort.
   */
  rankAndSelect(items: NewsItem[], _count?: number): NewsItem[] {
    // Step 1: Only keep paired (bilingual) items
    const paired = items.filter((i) => i.pairingStatus === 'paired');

    // Step 2: Score all paired items
    const scored = paired.map((item) => ({ ...item, importanceScore: this.computeImportanceScore(item) }));

    // Step 3: Sort by importance and assign rank
    scored.sort((a, b) => b.importanceScore - a.importanceScore);
    return scored.map((item, i) => ({ ...item, rank: i + 1 }));
  }
}
