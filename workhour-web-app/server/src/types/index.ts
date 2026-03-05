/**
 * 工时管理 Web 应用 - 类型定义
 * 复用自 feishu-workhour-bot 的核心类型 + Web 应用扩展类型
 */

// ============================================================
// 复用类型（来自 feishu-workhour-bot）
// ============================================================

/**
 * 多维表格配置
 */
export interface BitableConfig {
  /** 多维表格 app_token */
  appToken: string;
  /** 口译表 table_id */
  interpretationTableId: string;
  /** 笔译表 table_id */
  translationTableId: string;
  /** 状态字段名（承接进度） */
  statusFieldName: string;
  /** 工时统计字段名 */
  workhourFieldName: string;
}

/**
 * 项目类型
 */
export type ProjectType = 'interpretation' | 'translation';

/**
 * 工时记录
 */
export interface TimeRecord {
  /** 记录唯一标识 */
  id: number;
  /** 译员 ID */
  translatorId: string;
  /** 译员姓名 */
  translatorName: string;
  /** 项目 ID */
  projectId: string;
  /** 项目名称 */
  projectName: string;
  /** 工时类型：口译或笔译 */
  type: 'interpretation' | 'translation';
  /** 工时（分钟） */
  time: number;
  /** 日期（ISO 8601 格式） */
  date: string;
}

/**
 * 译员信息
 */
export interface Translator {
  /** 译员唯一标识 */
  id: string;
  /** 译员姓名 */
  name: string;
  /** 飞书 open_id，用于关联飞书用户 */
  feishuOpenId: string;
}

/**
 * 项目信息（来自飞书多维表格）
 */
export interface Project {
  /** 多维表格记录 ID */
  recordId: string;
  /** 项目名称 */
  name: string;
  /** 项目状态 */
  status: string;
  /** 项目类型：口译或笔译 */
  projectType: 'interpretation' | 'translation';
}

/**
 * Tracker 数据存储结构
 */
export interface TrackerData {
  /** 译员列表 */
  translators: Translator[];
  /** 项目列表（按类型分组） */
  projects: {
    interpretation: ProjectItem[];
    translation: ProjectItem[];
  };
  /** 工时记录列表 */
  timeRecords: TimeRecord[];
}

/**
 * 项目列表项
 */
export interface ProjectItem {
  /** 项目 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目状态 */
  status: string;
}

// ============================================================
// Web 应用扩展类型
// ============================================================

/**
 * JWT Payload
 */
export interface JwtPayload {
  userId: string;
  feishuOpenId: string;
  name: string;
  avatar?: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * 前端用户信息
 */
export interface UserInfo {
  userId: string;
  feishuOpenId: string;
  name: string;
  avatar?: string;
  isAdmin?: boolean;
}

/**
 * 工时提交请求
 */
export interface TimeRecordSubmitRequest {
  entries: Array<{
    projectId: string;
    projectName: string;
    type: 'interpretation' | 'translation';
    time: number;
  }>;
}

/**
 * 统计数据响应
 */
export interface StatsResponse {
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
    type: 'interpretation' | 'translation';
    totalTime: number;
  }>;
}

/**
 * 统一 API 响应格式
 * Validates: Requirements 8.10
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// Express Request 扩展（认证中间件）
// ============================================================

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
