import { randomUUID } from 'crypto';
import { FileStorageService } from './FileStorageService';
import {
  StudySession,
  CreateSessionInput,
  StudySessionsFile,
} from '../types/briefing';

const SESSIONS_FILENAME = 'study-sessions.json';

export class StudySessionService {
  constructor(private fileStorage: FileStorageService) {}

  private async loadSessions(userId: string): Promise<StudySessionsFile> {
    const data = await this.fileStorage.readJson<StudySessionsFile | null>(userId, SESSIONS_FILENAME);
    if (!data) {
      return { version: 1, sessions: [] };
    }
    return data;
  }

  private async saveSessions(userId: string, file: StudySessionsFile): Promise<void> {
    await this.fileStorage.writeJson(userId, SESSIONS_FILENAME, file);
  }

  async createSession(userId: string, input: CreateSessionInput): Promise<StudySession> {
    const now = new Date().toISOString();
    const session: StudySession = {
      id: randomUUID(),
      newsEntryId: input.newsEntryId,
      newsDate: input.newsDate,
      chineseTitle: input.chineseTitle,
      chineseContent: input.chineseContent,
      englishUrl: null,
      englishContent: null,
      englishHtmlContent: null,
      englishSourceName: null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const file = await this.loadSessions(userId);
    file.sessions.push(session);
    await this.saveSessions(userId, file);

    return session;
  }

  async getSessions(userId: string): Promise<StudySession[]> {
    const file = await this.loadSessions(userId);
    return file.sessions;
  }

  async getSession(userId: string, sessionId: string): Promise<StudySession | null> {
    const file = await this.loadSessions(userId);
    return file.sessions.find((s) => s.id === sessionId) ?? null;
  }

  async updateSession(userId: string, sessionId: string, updates: Partial<StudySession>): Promise<void> {
    const file = await this.loadSessions(userId);
    const index = file.sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) {
      throw new Error('NOT_FOUND: 研习会话不存在');
    }

    const session = file.sessions[index];

    // Auto-set status to 'completed' when englishContent is provided
    if (updates.englishContent !== undefined && updates.englishContent !== null) {
      updates.status = 'completed';
    }

    file.sessions[index] = {
      ...session,
      ...updates,
      id: session.id, // prevent overwriting id
      updatedAt: new Date().toISOString(),
    };

    await this.saveSessions(userId, file);
  }
}
