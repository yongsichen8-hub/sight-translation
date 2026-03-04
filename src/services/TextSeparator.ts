/**
 * TextSeparator 服务
 * 使用 OpenAI 自动识别并分离中英文文本
 * 自动将繁体中文转换为简体中文
 */

import type { OpenAIConfig } from '../types';
import { smartConvert } from './ChineseConverter';

export interface SeparatedText {
  chinese: string;
  english: string;
}

export interface ITextSeparator {
  /**
   * 分离混合文本中的中英文
   * @param text 包含中英文的混合文本
   * @returns 分离后的中英文文本
   */
  separate(text: string): Promise<SeparatedText>;
}

/**
 * 检查是否支持 JSON 模式
 */
function supportsJsonMode(baseUrl: string): boolean {
  if (baseUrl.includes('openai.com')) return true;
  if (baseUrl.includes('bigmodel.cn')) return true;
  if (baseUrl.includes('deepseek.com')) return true; // DeepSeek 支持 json_object
  return false;
}

export class TextSeparator implements ITextSeparator {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    // 确保使用传入的配置，只有在未提供时才使用默认值
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
    };
    console.log('TextSeparator config:', { baseUrl: this.config.baseUrl, model: this.config.model });
  }

  async separate(text: string): Promise<SeparatedText> {
    // 如果没有 API KEY，直接使用本地分离
    if (!this.config.apiKey) {
      console.log('No API key provided, using local separation');
      return this.localSeparate(text);
    }

    // 如果文本很短，尝试本地检测
    if (text.length < 50) {
      return this.localSeparate(text);
    }

    try {
      const useJsonMode = supportsJsonMode(this.config.baseUrl || '');
      
      const requestBody: Record<string, unknown> = {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are a text separator. Given a document containing both Chinese and English text (which are translations of each other), separate them into two parts.

Rules:
1. Identify which parts are Chinese and which are English
2. Maintain the original order of paragraphs within each language
3. Return a JSON object with "chinese" and "english" fields
4. If the text is only in one language, put it in the appropriate field and leave the other empty
5. Do not translate - just separate existing text
IMPORTANT: Return ONLY valid JSON, no other text or explanation.`,
          },
          {
            role: 'user',
            content: `Separate the following text into Chinese and English parts:\n\n${text}`,
          },
        ],
        temperature: 0.1,
      };

      if (useJsonMode) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response');
      }

      // 尝试解析 JSON
      let result;
      try {
        result = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse JSON');
        }
      }

      return {
        chinese: smartConvert(result.chinese || ''),
        english: result.english || '',
      };
    } catch (error) {
      console.warn('AI separation failed, using local detection:', error);
      return this.localSeparate(text);
    }
  }

  /**
   * 本地分离（备用方案）
   * 基于字符检测分离中英文段落
   */
  private localSeparate(text: string): SeparatedText {
    const paragraphs = text.split(/\n\n+/);
    const chinese: string[] = [];
    const english: string[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // 统计中文字符比例
      const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
      const ratio = chineseChars / trimmed.length;

      if (ratio > 0.3) {
        chinese.push(trimmed);
      } else {
        english.push(trimmed);
      }
    }

    return {
      chinese: smartConvert(chinese.join('\n\n')),
      english: english.join('\n\n'),
    };
  }
}

export function createTextSeparator(config: OpenAIConfig): TextSeparator {
  return new TextSeparator(config);
}
