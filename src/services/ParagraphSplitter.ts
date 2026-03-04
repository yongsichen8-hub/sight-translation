/**
 * ParagraphSplitter 服务
 * 将文本按意群切分为段落（3-4句为一段）
 * 支持将两段文本切分为相同数量的段落，用于中英文对齐
 */

import { Language, ParagraphConfig, DEFAULT_PARAGRAPH_CONFIG } from '../types/models';

/**
 * ParagraphSplitter 接口
 */
export interface IParagraphSplitter {
  split(text: string, language: Language): string[];
  splitAligned(chineseText: string, englishText: string): { chinese: string[]; english: string[] };
}

/**
 * ParagraphSplitter 实现类
 */
export class ParagraphSplitter implements IParagraphSplitter {
  private config: ParagraphConfig;

  constructor(config: ParagraphConfig = DEFAULT_PARAGRAPH_CONFIG) {
    this.config = config;
  }

  split(text: string, language: Language): string[] {
    if (!text || text.trim().length === 0) return [];
    const sentences = this.splitToSentences(text, language);
    if (sentences.length === 0) return [];
    return this.groupIntoParagraphs(sentences);
  }

  /**
   * 将中英文文本切分为相同数量的段落
   * 先切分中文，再把英文强制切成同样数量的段落
   */
  splitAligned(chineseText: string, englishText: string): { chinese: string[]; english: string[] } {
    const chineseParagraphs = this.split(chineseText, 'zh');
    const targetCount = chineseParagraphs.length;

    if (targetCount === 0) {
      return { chinese: [], english: [] };
    }

    const englishParagraphs = this.splitToCount(englishText, 'en', targetCount);
    return { chinese: chineseParagraphs, english: englishParagraphs };
  }

  /**
   * 将文本强制切分为指定数量的段落（均匀分配句子）
   */
  private splitToCount(text: string, language: Language, count: number): string[] {
    if (!text || text.trim().length === 0) return Array(count).fill('');

    const sentences = this.splitToSentences(text, language);
    if (sentences.length === 0) return Array(count).fill('');

    const paragraphs: string[] = [];
    const perGroup = sentences.length / count;

    for (let i = 0; i < count; i++) {
      const start = Math.round(i * perGroup);
      const end = Math.round((i + 1) * perGroup);
      const group = sentences.slice(start, end);
      paragraphs.push(group.join(' ').trim());
    }

    return paragraphs;
  }

  private splitToSentences(text: string, language: Language): string[] {
    const terminators = language === 'zh'
      ? this.config.zhTerminators
      : this.config.enTerminators;

    if (terminators.length === 0) return [text.trim()];

    return language === 'en'
      ? this.splitEnglish(text, terminators)
      : this.splitChinese(text, terminators);
  }

  private splitChinese(text: string, terminators: string[]): string[] {
    const sentences: string[] = [];
    let current = '';

    for (const char of text) {
      current += char;
      if (terminators.includes(char)) {
        const trimmed = current.trim();
        if (trimmed) sentences.push(trimmed);
        current = '';
      }
    }

    const remaining = current.trim();
    if (remaining) sentences.push(remaining);
    return sentences;
  }

  private splitEnglish(text: string, terminators: string[]): string[] {
    const sentences: string[] = [];
    let current = '';
    const abbreviations = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'i.e', 'e.g', 'Inc', 'Ltd', 'Corp', 'St', 'Ave', 'No', 'Vol'];

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      current += char;

      if (terminators.includes(char)) {
        const beforePunc = current.slice(0, -1).trim();
        const lastWord = beforePunc.split(/\s+/).pop() || '';
        const nextChar = text.charAt(i + 1);

        if (char === '.' && abbreviations.some(a => lastWord.toLowerCase() === a.toLowerCase())) continue;
        if (char === '.' && /[a-z0-9]/i.test(nextChar)) continue;

        const isEnd = i === text.length - 1;
        const isSpace = /[\s]/.test(nextChar);
        const isUpper = /[A-Z]/.test(nextChar);

        if (isEnd || isSpace || isUpper) {
          const trimmed = current.trim();
          if (trimmed) sentences.push(trimmed);
          current = '';
        }
      }
    }

    const remaining = current.trim();
    if (remaining) sentences.push(remaining);
    return sentences;
  }

  private groupIntoParagraphs(sentences: string[]): string[] {
    const paragraphs: string[] = [];
    const perParagraph = this.config.sentencesPerParagraph;

    for (let i = 0; i < sentences.length; i += perParagraph) {
      const group = sentences.slice(i, i + perParagraph);
      paragraphs.push(group.join(' '));
    }

    return paragraphs;
  }
}

export const paragraphSplitter = new ParagraphSplitter();
