/**
 * 核心类型定义
 * 定义工时追踪系统的核心数据结构
 */

/**
 * 工时记录
 * 验证: 需求 4.2 - 工时记录包含字段：translatorId、translatorName、projectId、projectName、
 * type（interpretation/translation）、time（分钟数）、date（ISO 8601 格式时间戳）
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
 * 验证: 需求 6.1 - 从飞书消息事件中提取发送者的 open_id 和用户名
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
 * 项目信息
 * 用于从飞书多维表格读取的项目数据
 */
export interface Project {
  /** 多维表格记录 ID */
  recordId: string;
  /** 项目名称 */
  name: string;
  /** 项目状态：承接、拒接、进行中、已完成 */
  status: string;
  /** 项目类型：口译或笔译 */
  projectType: 'interpretation' | 'translation';
}

/**
 * 飞书用户信息
 * 验证: 需求 6.1 - 从飞书消息事件中提取发送者的 open_id 和用户名
 */
export interface FeishuUser {
  /** 飞书用户 open_id */
  open_id: string;
  /** 飞书用户 user_id（可选） */
  user_id?: string;
  /** 用户姓名 */
  name: string;
  /** 用户头像 URL（可选） */
  avatar_url?: string;
}

/**
 * Tracker 数据存储结构
 * 与现有 workhour-tracker 的 localStorage 结构保持兼容
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
 * 用于本地存储的项目数据结构
 */
export interface ProjectItem {
  /** 项目 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目状态 */
  status: string;
}

/**
 * 工时提交摘要
 * 用于构建成功提示卡片
 */
export interface SubmitSummary {
  /** 译员姓名 */
  translatorName: string;
  /** 口译项目名称（可选） */
  interpretationProject?: string;
  /** 口译工时（分钟，可选） */
  interpretationTime?: number;
  /** 笔译项目名称（可选） */
  translationProject?: string;
  /** 笔译工时（分钟，可选） */
  translationTime?: number;
  /** 提交时间 */
  submitTime: string;
}
