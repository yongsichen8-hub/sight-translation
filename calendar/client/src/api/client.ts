import type {
  AuthResponse,
  WorkEntry,
  CreateWorkEntryDTO,
  Category,
  OKRData,
  Objective,
  CreateObjectiveDTO,
  UpdateObjectiveDTO,
  KeyResult,
  CreateKeyResultDTO,
  UpdateKeyResultDTO,
  InspirationEntry,
  CreateInspirationDTO,
  UpdateInspirationDTO,
  InspirationCategory,
  Summary,
  SummaryType,
} from '@/types';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText, res.status);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json();
}

export const apiClient = {
  auth: {
    register(username: string, password: string): Promise<AuthResponse> {
      return request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    login(username: string, password: string): Promise<AuthResponse> {
      return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    logout(): Promise<void> {
      return request('/api/auth/logout', { method: 'POST' });
    },
  },

  workEntries: {
    getByWeek(weekStart: string): Promise<WorkEntry[]> {
      return request(`/api/work-entries?week=${encodeURIComponent(weekStart)}`);
    },
    save(entries: CreateWorkEntryDTO[]): Promise<WorkEntry[]> {
      return request('/api/work-entries', {
        method: 'POST',
        body: JSON.stringify(entries),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/work-entries/${id}`, { method: 'DELETE' });
    },
  },

  categories: {
    list(): Promise<Category[]> {
      return request('/api/categories');
    },
    create(name: string): Promise<Category> {
      return request('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    update(id: number, name: string): Promise<Category> {
      return request(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },
    delete(id: number, migrateToId?: number): Promise<void> {
      const query = migrateToId != null ? `?migrateToId=${migrateToId}` : '';
      return request(`/api/categories/${id}${query}`, { method: 'DELETE' });
    },
  },

  okr: {
    getByQuarter(quarter: string): Promise<OKRData> {
      return request(`/api/okr?quarter=${encodeURIComponent(quarter)}`);
    },
    createObjective(obj: CreateObjectiveDTO): Promise<Objective> {
      return request('/api/okr/objectives', {
        method: 'POST',
        body: JSON.stringify(obj),
      });
    },
    updateObjective(id: number, obj: UpdateObjectiveDTO): Promise<Objective> {
      return request(`/api/okr/objectives/${id}`, {
        method: 'PUT',
        body: JSON.stringify(obj),
      });
    },
    deleteObjective(id: number): Promise<void> {
      return request(`/api/okr/objectives/${id}`, { method: 'DELETE' });
    },
    createKeyResult(kr: CreateKeyResultDTO): Promise<KeyResult> {
      return request('/api/okr/key-results', {
        method: 'POST',
        body: JSON.stringify(kr),
      });
    },
    updateKeyResult(id: number, kr: UpdateKeyResultDTO): Promise<KeyResult> {
      return request(`/api/okr/key-results/${id}`, {
        method: 'PUT',
        body: JSON.stringify(kr),
      });
    },
    deleteKeyResult(id: number): Promise<void> {
      return request(`/api/okr/key-results/${id}`, { method: 'DELETE' });
    },
  },

  inspirations: {
    list(categoryId?: number): Promise<InspirationEntry[]> {
      const query = categoryId != null ? `?categoryId=${categoryId}` : '';
      return request(`/api/inspirations${query}`);
    },
    create(entry: CreateInspirationDTO): Promise<InspirationEntry> {
      return request('/api/inspirations', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    update(id: number, entry: UpdateInspirationDTO): Promise<InspirationEntry> {
      return request(`/api/inspirations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(entry),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/inspirations/${id}`, { method: 'DELETE' });
    },
  },

  inspirationCategories: {
    list(): Promise<InspirationCategory[]> {
      return request('/api/inspiration-categories');
    },
    create(name: string): Promise<InspirationCategory> {
      return request('/api/inspiration-categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    update(id: number, name: string): Promise<InspirationCategory> {
      return request(`/api/inspiration-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/inspiration-categories/${id}`, { method: 'DELETE' });
    },
  },

  summaries: {
    generate(type: SummaryType, target: string): Promise<Summary> {
      return request('/api/summaries/generate', {
        method: 'POST',
        body: JSON.stringify({ type, target }),
      });
    },
    list(): Promise<Summary[]> {
      return request('/api/summaries');
    },
    getById(id: number): Promise<Summary> {
      return request(`/api/summaries/${id}`);
    },
  },
};

export { ApiError };
export type { ApiClient };

interface ApiClient {
  auth: typeof apiClient.auth;
  workEntries: typeof apiClient.workEntries;
  categories: typeof apiClient.categories;
  okr: typeof apiClient.okr;
  inspirations: typeof apiClient.inspirations;
  inspirationCategories: typeof apiClient.inspirationCategories;
  summaries: typeof apiClient.summaries;
}
