// API 基础 URL
// 开发环境使用 localhost:3001，生产环境通过 nginx 反向代理走 /sight-translation
function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 开发环境（Vite dev server）
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  // 生产环境：通过 nginx 反向代理，API 走同一域名的 /sight-translation 路径
  return '/sight-translation';
}

const API_BASE_URL = getApiBaseUrl();

// 类型定义
export interface AuthUser {
  userId: string;
  feishuUserId: string;
  username: string;
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

// Notebook 类型定义
export interface NotebookProject {
  id: string;
  title: string;
  domain: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookProjectInput {
  title: string;
  domain?: string;
  startDate?: string;
  endDate?: string;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface MemoContent {
  type: 'doc';
  content: TiptapNode[];
}

export interface OrganizedResult {
  markdown: string;
  organizedAt: string;
}

export interface BilingualExpression {
  chinese: string;
  english: string;
}

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
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

  async register(username: string, password: string): Promise<AuthUser> {
    const data = await this.request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return data.user;
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const data = await this.request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
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

  async migrateFeishuUser(feishuUserId: string, username: string, password: string): Promise<AuthUser> {
    const data = await this.request<{ user: AuthUser }>('/api/auth/migrate-feishu', {
      method: 'POST',
      body: JSON.stringify({ feishuUserId, username, password }),
    });
    return data.user;
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

  async deleteExpressionsBatch(ids: string[]): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/api/expressions/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
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

  // ==================== 笔记本相关 ====================

  async getNotebooks(): Promise<NotebookProject[]> {
    return this.request<NotebookProject[]>('/api/notebooks');
  }

  async createNotebook(input: NotebookProjectInput): Promise<NotebookProject> {
    return this.request<NotebookProject>('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateNotebook(id: string, updates: Partial<NotebookProjectInput>): Promise<void> {
    await this.request(`/api/notebooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteNotebook(id: string): Promise<void> {
    await this.request(`/api/notebooks/${id}`, { method: 'DELETE' });
  }

  async getMemo(notebookId: string): Promise<MemoContent> {
    return this.request<MemoContent>(`/api/notebooks/${notebookId}/memo`);
  }

  async saveMemo(notebookId: string, content: MemoContent): Promise<void> {
    await this.request(`/api/notebooks/${notebookId}/memo`, {
      method: 'PUT',
      body: JSON.stringify(content),
    });
  }

  async organizeNotes(notebookId: string): Promise<OrganizedResult> {
    return this.request<OrganizedResult>(`/api/notebooks/${notebookId}/organize`, {
      method: 'POST',
    });
  }

  async getOrganizedResult(notebookId: string): Promise<OrganizedResult | null> {
    try {
      return await this.request<OrganizedResult>(`/api/notebooks/${notebookId}/organized`);
    } catch {
      return null;
    }
  }

  async exportExpressions(notebookId: string): Promise<BilingualExpression[]> {
    return this.request<BilingualExpression[]>(`/api/notebooks/${notebookId}/export-expressions`, {
      method: 'POST',
    });
  }

  async getAiSettings(): Promise<AiSettings> {
    return this.request<AiSettings>('/api/notebooks/settings/ai');
  }

  async saveAiSettings(settings: AiSettings): Promise<void> {
    await this.request('/api/notebooks/settings/ai', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

// 导出单例
export const apiClient = new ApiClient();
