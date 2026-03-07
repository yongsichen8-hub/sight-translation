import * as fs from 'fs';
import * as path from 'path';
import { NewsSource, SourceRegistry, NewsDomain } from '../types/news';

const VALID_TIERS = ['T1', 'T2'] as const;

export class SourceRegistryService {
  private registry: SourceRegistry;

  constructor(registryPath?: string) {
    const filePath = registryPath || this.resolveRegistryPath();
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.registry = JSON.parse(content) as SourceRegistry;
      this.validate();
    } catch (err) {
      console.warn(`⚠️ 无法加载 sourceRegistry.json (${filePath})，使用空注册表`);
      this.registry = { version: 0, sources: [], lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * 解析 sourceRegistry.json 路径，兼容开发和生产环境
   */
  private resolveRegistryPath(): string {
    // 优先尝试 src/data 目录（开发环境 ts-node 或生产环境项目根目录）
    const candidates = [
      path.join(__dirname, '..', 'data', 'sourceRegistry.json'),           // dist/data/ 或 src/data/
      path.join(__dirname, '..', '..', 'src', 'data', 'sourceRegistry.json'), // 从 dist/ 回溯到 src/data/
      path.join(process.cwd(), 'src', 'data', 'sourceRegistry.json'),       // 从 cwd 查找
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0]; // 回退到默认路径（会在 constructor 中被 catch）
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
