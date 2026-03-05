import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Intercept 401 responses → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if on login page or during OAuth callback
      const path = window.location.pathname;
      if (path !== '/login' && !path.startsWith('/auth/')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export async function getAuthUrl() {
  const res = await api.get('/auth/feishu');
  return res.data.data as { url: string; state: string };
}

export async function handleAuthCallback(code: string, state: string) {
  const res = await api.get('/auth/feishu/callback', { params: { code, state } });
  return res.data.data as { user: UserInfo };
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data.data as UserInfo;
}

export async function logout() {
  const res = await api.post('/auth/logout');
  return res.data;
}

// Project APIs
export async function getProjects(type?: string) {
  const params = type ? { type } : {};
  const res = await api.get('/projects', { params });
  return res.data.data as { interpretation: Project[]; translation: Project[] };
}

// Time Record APIs
export async function submitTimeRecords(entries: TimeRecordEntry[]) {
  const res = await api.post('/time-records', { entries });
  return res.data.data as { records: TimeRecord[]; syncStatus: string };
}

export async function getTimeRecords(filters?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const res = await api.get('/time-records', { params: filters });
  return res.data.data as TimeRecord[];
}

// Stats APIs
export async function getStats(filters?: { startDate?: string; endDate?: string }) {
  const res = await api.get('/stats', { params: filters });
  return res.data.data as StatsData;
}

// Types (shared with backend, defined here for frontend use)
export interface UserInfo {
  userId: string;
  feishuOpenId: string;
  name: string;
  avatar?: string;
  isAdmin?: boolean;
}

export interface Project {
  recordId: string;
  name: string;
  status: string;
  projectType: 'interpretation' | 'translation';
}

export interface TimeRecordEntry {
  projectId: string;
  projectName: string;
  type: 'interpretation' | 'translation';
  time: number;
}

export interface TimeRecord {
  id: number;
  translatorId: string;
  translatorName: string;
  projectId: string;
  projectName: string;
  type: 'interpretation' | 'translation';
  time: number;
  date: string;
}

export interface StatsData {
  totalTime: number;
  interpretationTime: number;
  translationTime: number;
  translatorCount: number;
  byTranslator: Array<{
    name: string;
    totalTime: number;
    interpretationTime: number;
    translationTime: number;
  }>;
  byProject: Array<{
    name: string;
    type: string;
    totalTime: number;
  }>;
}

// Admin APIs
export async function getAllTimeRecords(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const res = await api.get('/time-records/all', { params: filters });
  return res.data.data as TimeRecord[];
}

export async function updateTimeRecord(id: number, time: number) {
  const res = await api.put(`/time-records/${id}`, { time });
  return res.data.data as { record: TimeRecord; syncStatus: string };
}
