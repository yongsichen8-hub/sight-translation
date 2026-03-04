/**
 * SentenceSplitter 服务
 * 将文本切分为独立句子，支持中英文标点
 */

import { Language, SplitConfig, DEFAULT_SPLIT_CONFIG } from '../types/models';

/**
 * SentenceSplitter 接口
 */
export interface ISentenceSplitter {
  /**
   * 将文本切分为句子数组
   * @param text 原始文本
   * @param language 文本语言
   * @returns 句子数组，保持原始顺序
   */
  split(text: string, language: Language): string[];
}

/**
 * SentenceSplitter 实现类
 */
export class SentenceSplitter implements ISentenceSplitter {
  private config: SplitConfig;

  constructor(config: SplitConfig = DEFAULT_SPLIT_CONFIG) {
    this.config = config;
  }

  /**
   * 将文本切分为句子数组
   * @param text 原始文本
   * @param language 文本语言 ('zh' | 'en')
   * @returns 句子数组，保持原始顺序
   */
  split(text: string, language: Language): string[] {
    // 处理空文本或仅空白文本
    if (!text || text.trim().length === 0) {
      return [];
    }

    const terminators = language === 'zh' 
      ? this.config.zhTerminators 
      : this.config.enTerminators;

    // 如果没有配置终止符，返回整个文本作为单个句子
    if (terminators.length === 0) {
      return [text.trim()];
    }

    if (language === 'en') {
      // 英文切分：使用正则匹配句末标点后跟空格或文本结尾
      return this.splitEnglish(text, terminators);
    } else {
      // 中文切分：直接按标点切分
      return this.splitChinese(text, terminators);
    }
  }

  /**
   * 切分中文文本
   */
  private splitChinese(text: string, terminators: string[]): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      currentSentence += char;

      if (terminators.includes(char)) {
        const trimmed = currentSentence.trim();
        if (trimmed.length > 0) {
          sentences.push(this.config.preservePunctuation ? trimmed : this.removePunctuation(trimmed, terminators));
        }
        currentSentence = '';
      }
    }

    // 处理最后一个没有标点的句子
    const remaining = currentSentence.trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences;
  }


  /**
   * 切分英文文本
   * 特殊处理：避免在常见缩写后切分
   */
  private splitEnglish(text: string, terminators: string[]): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    // 常见英文缩写列表
    const abbreviations = [
      'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
      'vs', 'etc', 'i.e', 'e.g', 'Inc', 'Ltd', 'Corp',
      'St', 'Ave', 'Blvd', 'Rd', 'No', 'Vol', 'Fig'
    ];

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      currentSentence += char;

      if (terminators.includes(char)) {
        // 检查是否是缩写
        const beforePunctuation = currentSentence.slice(0, -1).trim();
        const lastWord = this.getLastWord(beforePunctuation);
        
        // 检查下一个字符是否是空格或文本结尾
        const nextChar: string | undefined = i + 1 < text.length ? text.charAt(i + 1) : undefined;
        const isEndOfText = i === text.length - 1;
        const isFollowedBySpace = nextChar === ' ' || nextChar === '\n' || nextChar === '\r';
        const isFollowedByUpperCase = nextChar !== undefined && /[A-Z]/.test(nextChar);

        // 如果是缩写后的句号，不切分
        if (char === '.' && abbreviations.some(abbr => 
          lastWord.toLowerCase() === abbr.toLowerCase() ||
          lastWord.toLowerCase().endsWith(abbr.toLowerCase())
        )) {
          continue;
        }

        // 如果句号后面紧跟小写字母，可能是小数或缩写，不切分
        if (char === '.' && nextChar !== undefined && /[a-z0-9]/.test(nextChar)) {
          continue;
        }

        // 正常切分
        if (isEndOfText || isFollowedBySpace || isFollowedByUpperCase) {
          const trimmed = currentSentence.trim();
          if (trimmed.length > 0) {
            sentences.push(this.config.preservePunctuation ? trimmed : this.removePunctuation(trimmed, terminators));
          }
          currentSentence = '';
        }
      }
    }

    // 处理最后一个没有标点的句子
    const remaining = currentSentence.trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences;
  }

  /**
   * 获取字符串中的最后一个单词
   */
  private getLastWord(text: string): string {
    const words = text.split(/\s+/);
    return words[words.length - 1] || '';
  }

  /**
   * 移除句末标点
   */
  private removePunctuation(sentence: string, terminators: string[]): string {
    let result = sentence;
    for (const terminator of terminators) {
      if (result.endsWith(terminator)) {
        result = result.slice(0, -terminator.length);
        break;
      }
    }
    return result.trim();
  }
}

/**
 * 默认 SentenceSplitter 实例
 */
export const sentenceSplitter = new SentenceSplitter();
