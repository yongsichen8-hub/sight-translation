/**
 * 数据模型类型定义
 * 视译练习软件的核心数据结构
 */

/**
 * 语言类型
 */
export type Language = 'zh' | 'en';

/**
 * 段落对数据模型
 * 中英文段落的语义匹配对
 */
export interface ParagraphPair {
  /** 段落索引 */
  index: number;
  /** 中文段落 */
  chinese: string;
  /** 英文段落 */
  english: string;
}

/**
 * 项目数据模型
 * 包含同一文本的中英双语版本的练习单元
 */
export interface Project {
  /** UUID */
  id: string;
  /** 项目名称（唯一） */
  name: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 中文原文 */
  chineseText: string;
  /** 英文原文 */
  englishText: string;
  /** 切分后的中文段落 */
  chineseParagraphs: string[];
  /** 切分后的英文段落 */
  englishParagraphs: string[];
  /** 语义匹配的段落对 */
  paragraphPairs: ParagraphPair[];
}

/**
 * 项目创建输入 - 双文件模式
 */
export interface ProjectInputDualFile {
  mode: 'dual-file';
  name: string;
  chineseFile: File;
  englishFile: File;
}

/**
 * 项目创建输入 - 单文件模式（中英文混合）
 */
export interface ProjectInputSingleFile {
  mode: 'single-file';
  name: string;
  file: File;
}

/**
 * 项目创建输入 - 直接文本输入
 */
export interface ProjectInputText {
  mode: 'text';
  name: string;
  text: string;
}

/**
 * 项目创建输入 - 图片 OCR
 */
export interface ProjectInputImage {
  mode: 'image';
  name: string;
  images: File[];
}

/**
 * 项目创建输入（联合类型）
 */
export type ProjectInput = 
  | ProjectInputDualFile 
  | ProjectInputSingleFile 
  | ProjectInputText 
  | ProjectInputImage;

/**
 * 旧版项目输入（兼容性）
 * @deprecated 使用 ProjectInputDualFile
 */
export interface LegacyProjectInput {
  name: string;
  chineseFile: File;
  englishFile: File;
}

/**
 * 表达/术语数据模型
 * 用户收藏的翻译术语对
 */
export interface Expression {
  /** UUID */
  id: string;
  /** 所属项目ID */
  projectId: string;
  /** 中文术语 */
  chinese: string;
  /** 英文术语 */
  english: string;
  /** 用户备注 */
  notes: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 表达创建输入
 */
export interface ExpressionInput {
  projectId: string;
  /** 中文术语 */
  chinese: string;
  /** 英文术语 */
  english: string;
  notes?: string;
}

/**
 * 表达过滤条件
 */
export interface ExpressionFilter {
  sourceLanguage?: Language;
  keyword?: string;
}

/**
 * Flashcard 数据模型
 * 基于艾宾浩斯记忆曲线的复习卡片
 */
export interface Flashcard {
  /** UUID */
  id: string;
  /** 关联的表达ID */
  expressionId: string;
  /** 当前复习间隔索引 (0-5) */
  currentInterval: number;
  /** 下次复习日期 */
  nextReviewDate: Date;
  /** 总复习次数 */
  reviewCount: number;
  /** 上次复习日期 */
  lastReviewDate: Date | null;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 复习记录
 * 用于统计复习历史
 */
export interface ReviewRecord {
  /** UUID */
  id: string;
  /** 关联的卡片ID */
  flashcardId: string;
  /** 复习时间 */
  reviewedAt: Date;
  /** 是否记住 */
  remembered: boolean;
}

/**
 * 艾宾浩斯复习间隔（天数）
 */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30] as const;

/**
 * 支持的文件类型
 */
export type SupportedFileType =
  | 'text/plain'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * 句子切分配置
 */
export interface SplitConfig {
  /** 中文句末标点 */
  zhTerminators: string[];
  /** 英文句末标点 */
  enTerminators: string[];
  /** 是否保留标点 */
  preservePunctuation: boolean;
}

/**
 * 默认句子切分配置
 */
export const DEFAULT_SPLIT_CONFIG: SplitConfig = {
  zhTerminators: ['。', '！', '？', '；'],
  enTerminators: ['.', '!', '?'],
  preservePunctuation: true,
};

/**
 * 段落切分配置
 */
export interface ParagraphConfig {
  /** 每段包含的句子数量 */
  sentencesPerParagraph: number;
  /** 中文句末标点 */
  zhTerminators: string[];
  /** 英文句末标点 */
  enTerminators: string[];
}

/**
 * 默认段落切分配置
 */
export const DEFAULT_PARAGRAPH_CONFIG: ParagraphConfig = {
  sentencesPerParagraph: 3,
  zhTerminators: ['。', '！', '？', '；'],
  enTerminators: ['.', '!', '?'],
};

/**
 * OpenAI 兼容 API 配置
 * 支持 OpenAI、智谱、通义千问、DeepSeek 等兼容接口
 */
export interface OpenAIConfig {
  apiKey: string;
  /** API 基础地址，默认 OpenAI */
  baseUrl?: string;
  /** 模型名称 */
  model?: string;
}

/**
 * 预设的 API 服务商
 */
export const API_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
  },
  zhipu: {
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    visionModel: 'glm-4v-flash',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    visionModel: 'deepseek-chat', // DeepSeek 暂不支持视觉
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    visionModel: 'qwen-vl-plus',
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    defaultModel: '',
    visionModel: '',
  },
} as const;

export type APIProvider = keyof typeof API_PROVIDERS;

/**
 * 句子对（保留兼容性）
 */
export interface SentencePair {
  index: number;
  source: string;
  target: string;
}
