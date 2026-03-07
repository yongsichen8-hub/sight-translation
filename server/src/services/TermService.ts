import { randomUUID } from 'crypto';
import { FileStorageService } from './FileStorageService';
import {
  Term,
  CreateTermInput,
  TermFilters,
  TermsFile,
} from '../types/briefing';

const TERMS_FILENAME = 'terms.json';

export class TermService {
  constructor(private fileStorage: FileStorageService) {}

  private async loadTerms(userId: string): Promise<TermsFile> {
    const data = await this.fileStorage.readJson<TermsFile | null>(userId, TERMS_FILENAME);
    if (!data) {
      return { version: 1, terms: [] };
    }
    return data;
  }

  private async saveTerms(userId: string, file: TermsFile): Promise<void> {
    await this.fileStorage.writeJson(userId, TERMS_FILENAME, file);
  }

  async createTerm(userId: string, input: CreateTermInput): Promise<Term> {
    // Validate chinese field is not empty or whitespace-only
    if (!input.chinese || input.chinese.trim() === '') {
      throw new Error('VALIDATION_ERROR: 中文释义为必填项');
    }

    const now = new Date().toISOString();
    const term: Term = {
      id: randomUUID(),
      english: input.english,
      chinese: input.chinese,
      domain: input.domain,
      context: input.context,
      studySessionId: input.studySessionId,
      sourceArticleTitle: input.sourceArticleTitle,
      createdAt: now,
      updatedAt: now,
    };

    const file = await this.loadTerms(userId);
    file.terms.push(term);
    await this.saveTerms(userId, file);

    return term;
  }

  async getTerms(userId: string, filters?: TermFilters): Promise<Term[]> {
    const file = await this.loadTerms(userId);
    let terms = file.terms;

    if (filters?.domain) {
      terms = terms.filter((t) => t.domain === filters.domain);
    }

    if (filters?.keyword) {
      const kw = filters.keyword.toLowerCase();
      terms = terms.filter(
        (t) =>
          t.english.toLowerCase().includes(kw) ||
          t.chinese.toLowerCase().includes(kw)
      );
    }

    // Sort by createdAt descending (newest first)
    terms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return terms;
  }

  async updateTerm(userId: string, termId: string, updates: Partial<Term>): Promise<void> {
    const file = await this.loadTerms(userId);
    const index = file.terms.findIndex((t) => t.id === termId);
    if (index === -1) {
      throw new Error('NOT_FOUND: 术语不存在');
    }

    const term = file.terms[index];
    file.terms[index] = {
      ...term,
      ...updates,
      id: term.id, // prevent overwriting id
      updatedAt: new Date().toISOString(),
    };

    await this.saveTerms(userId, file);
  }

  async deleteTerm(userId: string, termId: string): Promise<void> {
    const file = await this.loadTerms(userId);
    const index = file.terms.findIndex((t) => t.id === termId);
    if (index === -1) {
      throw new Error('NOT_FOUND: 术语不存在');
    }

    file.terms.splice(index, 1);
    await this.saveTerms(userId, file);
  }
}
