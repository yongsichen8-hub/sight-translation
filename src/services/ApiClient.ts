// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 类型定义
export interface AuthUser {
  userId: string;
  feishuUserId: string;
  name: string;
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  chineseText: string;
  englishText: string;
  chineseParagraphs: string[];
  englishParagraphs: string[];
  paragraphPairs: { index: number; chinese: string; english: string }[];
  practiceProgress?: { scrollPercentage: number; practiceTimeSeconds?: number; updatedAt: string };
  checkedIn?: boolean;
  checkedInAt?: string;
}

export interface Expression {
  id: string;
  projectId: string;
  chinese: string;
  english: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  expressionId: string;
  currentInterval: number;
  nextReviewDate: string;
  reviewCount: number;
  lastReviewDate: string | null;
  createdAt: string;
}

export interface MigrationResult {
  success: boolean;
  imported: {
    projects: number;
    expressions: number;
    flashcards: number;
    reviewRecords: number;
  };
  errors: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

class ApiClient {
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
      credentials: 'include', // 发送 Cookie
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

  // ==================== 认证相关 ====================

  async getLoginUrl(): Promise<string> {
    const data = await this.request<{ url: string }>('/api/auth/feishu/login');
    return data.url;
  }

  async handleCallback(code: string, state: string): Promise<AuthUser> {
    const data = await this.request<{ user: AuthUser }>(
      `/api/auth/feishu/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
    );
    return data.user;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      return await this.request<AuthUser>('/api/auth/me');
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }


  // ==================== 项目相关 ====================

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`);
  }

  async createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    await this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }

  async checkInProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}/checkin`, { method: 'POST' });
  }


  // ==================== 表达相关 ====================

  async getExpressions(keyword?: string): Promise<Expression[]> {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
    return this.request<Expression[]>(`/api/expressions${query}`);
  }

  async createExpression(input: Omit<Expression, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expression> {
    return this.request<Expression>('/api/expressions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateExpression(id: string, updates: Partial<Expression>): Promise<void> {
    await this.request(`/api/expressions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteExpression(id: string): Promise<void> {
    await this.request(`/api/expressions/${id}`, { method: 'DELETE' });
  }

  // ==================== 闪卡相关 ====================

  async getFlashcards(): Promise<Flashcard[]> {
    return this.request<Flashcard[]>('/api/flashcards');
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    return this.request<Flashcard[]>('/api/flashcards/due');
  }

  async recordReview(flashcardId: string, remembered: boolean): Promise<void> {
    await this.request(`/api/flashcards/${flashcardId}/review`, {
      method: 'POST',
      body: JSON.stringify({ remembered }),
    });
  }

  // ==================== 数据迁移 ====================

  async migrateLocalData(data: {
    projects: Project[];
    expressions: Expression[];
    flashcards: Flashcard[];
    reviewRecords: { id: string; flashcardId: string; reviewedAt: string; remembered: boolean }[];
  }): Promise<MigrationResult> {
    return this.request<MigrationResult>('/api/migration/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// 导出单例
export const apiClient = new ApiClient();
