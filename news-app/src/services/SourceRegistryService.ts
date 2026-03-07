import * as fs from 'fs';
import * as path from 'path';
import { NewsSource, SourceRegistry, NewsDomain } from '../types';

export class SourceRegistryService {
  private registry: SourceRegistry;

  constructor(registryPath?: string) {
    const filePath = registryPath || path.join(__dirname, '..', 'data', 'sourceRegistry.json');
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    this.registry = JSON.parse(content) as SourceRegistry;
  }

  getSources(): NewsSource[] {
    return this.registry.sources.filter((s) => s.enabled);
  }

  getSourceById(id: string): NewsSource | undefined {
    return this.registry.sources.find((s) => s.id === id);
  }
}
