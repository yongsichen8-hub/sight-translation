import * as fs from 'fs';
import * as path from 'path';
import { NewsSource, SourceRegistry, NewsDomain } from '../types/news';

const VALID_TIERS = ['T1', 'T2'] as const;

export class SourceRegistryService {
  private registry: SourceRegistry;

  constructor(registryPath?: string) {
    const filePath = registryPath || path.join(__dirname, '..', 'data', 'sourceRegistry.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    this.registry = JSON.parse(content) as SourceRegistry;
    this.validate();
  }

  /**
   * Validate all sources have a legal tier value (T1 or T2).
   * Throws on startup if any source has an invalid tier.
   */
  private validate(): void {
    for (const source of this.registry.sources) {
      if (!VALID_TIERS.includes(source.tier as typeof VALID_TIERS[number])) {
        throw new Error(
          `Invalid tier "${source.tier}" for source "${source.name}" (${source.id}). Must be T1 or T2.`
        );
      }
    }
  }

  /** Returns all enabled sources */
  getSources(): NewsSource[] {
    return this.registry.sources.filter((s) => s.enabled);
  }

  /** Returns a specific source by id, or undefined if not found */
  getSourceById(id: string): NewsSource | undefined {
    return this.registry.sources.find((s) => s.id === id);
  }

  /** Returns enabled sources filtered by language */
  getSourcesByLanguage(lang: 'zh' | 'en'): NewsSource[] {
    return this.registry.sources.filter((s) => s.enabled && s.language === lang);
  }

  /** Returns enabled sources filtered by domain */
  getSourcesByDomain(domain: NewsDomain): NewsSource[] {
    return this.registry.sources.filter((s) => s.enabled && s.domain === domain);
  }
}
