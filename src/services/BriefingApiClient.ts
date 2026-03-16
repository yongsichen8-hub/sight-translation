import type {
  StudySession,
  CreateSessionInput,
  Term,
  CreateTermInput,
  TermFilters,
} from '../types/briefing';

const API_BASE_URL = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  return '/sight-translation';
})();

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ExtractedContent {
  title: string;
  content: string;
  htmlContent: string;
  siteName: string;
  excerpt: string;
}

class BriefingApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || '请求失败');
    }

    return data.data as T;
  }

  // ==================== 研习会话相关 ====================

  async createStudySession(input: CreateSessionInput): Promise<StudySession> {
    return this.request<StudySession>('/api/study-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getStudySessions(): Promise<StudySession[]> {
    return this.request<StudySession[]>('/api/study-sessions');
  }

  async getStudySession(id: string): Promise<StudySession> {
    return this.request<StudySession>(`/api/study-sessions/${id}`);
  }

  async updateStudySession(id: string, updates: Partial<StudySession>): Promise<void> {
    await this.request(`/api/study-sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async extractEnglishContent(sessionId: string, url: string): Promise<ExtractedContent> {
    return this.request<ExtractedContent>(`/api/study-sessions/${sessionId}/extract`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // ==================== 术语相关 ====================

  async createTerm(input: CreateTermInput): Promise<Term> {
    return this.request<Term>('/api/terms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getTerms(filters?: TermFilters): Promise<Term[]> {
    const params = new URLSearchParams();
    if (filters?.domain) params.set('domain', filters.domain);
    if (filters?.keyword) params.set('keyword', filters.keyword);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Term[]>(`/api/terms${query}`);
  }

  async getTerm(id: string): Promise<Term> {
    return this.request<Term>(`/api/terms/${id}`);
  }

  async updateTerm(id: string, updates: Partial<Term>): Promise<void> {
    await this.request(`/api/terms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTerm(id: string): Promise<void> {
    await this.request(`/api/terms/${id}`, { method: 'DELETE' });
  }

  async deleteTermsBatch(ids: string[]): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/api/terms/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }
}

// 导出单例
export const briefingApiClient = new BriefingApiClient();
