// User types
export interface User {
  id: string;
  feishuUserId: string;
  name: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

// Project types
export interface ParagraphPair {
  index: number;
  chinese: string;
  english: string;
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
  paragraphPairs: ParagraphPair[];
}

export interface ProjectInput {
  name: string;
  chineseText: string;
  englishText: string;
  chineseParagraphs: string[];
  englishParagraphs: string[];
  paragraphPairs: ParagraphPair[];
}

// Expression types
export interface Expression {
  id: string;
  projectId: string;
  chinese: string;
  english: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionInput {
  projectId: string;
  chinese: string;
  english: string;
  notes?: string;
}

// Flashcard types
export interface Flashcard {
  id: string;
  expressionId: string;
  currentInterval: number;
  nextReviewDate: string;
  reviewCount: number;
  lastReviewDate: string | null;
  createdAt: string;
}

// Review record types
export interface ReviewRecord {
  id: string;
  flashcardId: string;
  reviewedAt: string;
  remembered: boolean;
}

export interface ReviewRecordInput {
  flashcardId: string;
  remembered: boolean;
}

// Feishu OAuth types
export interface FeishuOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface FeishuTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
}

export interface FeishuUserInfo {
  user_id: string;
  name: string;
  avatar_url: string;
  open_id: string;
  union_id: string;
}

// Auth types
export interface AuthResult {
  user: User;
  jwt: string;
  expiresIn: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  feishuUserId: string;
  name: string;
  iat: number;
  exp: number;
}

// API Response types
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// File storage types
export interface UserFile {
  id: string;
  feishuUserId: string;
  name: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsFile {
  version: number;
  projects: Project[];
}

export interface ExpressionsFile {
  version: number;
  expressions: Expression[];
}

export interface FlashcardsFile {
  version: number;
  flashcards: Flashcard[];
}

export interface ReviewRecordsFile {
  version: number;
  records: ReviewRecord[];
}

// Migration types
export interface LocalDataExport {
  projects: Project[];
  expressions: Expression[];
  flashcards: Flashcard[];
  reviewRecords: ReviewRecord[];
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

// Express request extension
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
