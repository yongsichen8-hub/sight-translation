// ============================================================
// User
// ============================================================

export interface User {
  id: number;
  username: string;
  createdAt: string;
}

// ============================================================
// Category
// ============================================================

export interface Category {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CategoryWithCount extends Category {
  workEntryCount: number;
  objectiveCount: number;
}

// ============================================================
// Work Entry
// ============================================================

export interface WorkEntry {
  id: number;
  categoryId: number;
  date: string;          // ISO 8601: "2025-01-06"
  timeSlot: string;      // "09:00-10:00"
  subCategory: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkEntryDTO {
  date: string;
  timeSlot: string;
  categoryId: number;
  subCategory: string;
  description: string;
}


// ============================================================
// OKR
// ============================================================

export interface Objective {
  id: number;
  categoryId: number;
  quarter: string;       // "2025-Q1"
  title: string;
  description: string;
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface KeyResult {
  id: number;
  objectiveId: number;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateObjectiveDTO {
  categoryId: number;
  quarter: string;
  title: string;
  description: string;
}

export interface UpdateObjectiveDTO {
  categoryId?: number;
  title?: string;
  description?: string;
}

export interface CreateKeyResultDTO {
  objectiveId: number;
  description: string;
}

export interface UpdateKeyResultDTO {
  description?: string;
  completed?: boolean;
}

export interface OKRData {
  quarter: string;
  objectives: Objective[];
}

// ============================================================
// Inspiration
// ============================================================

export interface InspirationEntry {
  id: number;
  categoryId: number;
  content: string;
  type: 'inspiration' | 'todo';
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationCategory {
  id: number;
  name: string;
  createdAt: string;
}

export interface CreateInspirationDTO {
  content: string;
  type: 'inspiration' | 'todo';
  categoryId: number;
}

export interface UpdateInspirationDTO {
  content?: string;
  type?: 'inspiration' | 'todo';
  categoryId?: number;
  completed?: boolean;
}

// ============================================================
// AI Summary
// ============================================================

export type SummaryType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface Summary {
  id: number;
  type: SummaryType;
  target: string;        // "2025-01-06" | "2025-W02" | "2025-01" | "2025-Q1"
  content: string;
  createdAt: string;
}

// ============================================================
// Auth
// ============================================================

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================================
// Reminder
// ============================================================

export interface ReminderState {
  skipped: Set<string>;              // "2025-01-06_09:00-10:00"
  snoozed: Map<string, number>;     // timeSlot -> snooze until timestamp
}
