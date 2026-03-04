/**
 * TermExplainer 服务
 * 使用 AI 生成术语的中英双语解释
 */

import type { OpenAIConfig } from '../types';

export interface TermExplanation {
  chineseExplanation: string;
  englishExplanation: string;
}

export interface ITermExplainer {
  explain(chinese: string, english: string): Promise<TermExplanation>;
}

/**
 * 检查是否支持 JSON 模式
 */
function supportsJsonMode(baseUrl: string): boolean {
  if (baseUrl.includes('openai.com')) return true;
  if (baseUrl.includes('bigmodel.cn')) return true;
  if (baseUrl.includes('deepseek.com')) return true;
  return false;
}

export class TermExplainer implements ITermExplainer {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
    };
  }

  async explain(chinese: string, english: string): Promise<TermExplanation> {
    const useJsonMode = supportsJsonMode(this.config.baseUrl || '');

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的术语解释助手。给定一个中英文术语对，请分别用中文和英文解释这个术语的含义。

要求：
1. 中文解释不超过100字，简洁准确
2. 英文解释不超过100词，简洁准确
3. 解释应该帮助翻译学习者理解术语的专业含义和使用场景
4. 返回 JSON 格式：{"chineseExplanation": "...", "englishExplanation": "..."}
5. 只返回 JSON，不要其他内容`,
        },
        {
          role: 'user',
          content: `请解释以下术语：\n中文：${chinese}\n英文：${english}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
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
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    // 解析 JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 返回的 JSON');
      }
    }

    return {
      chineseExplanation: result.chineseExplanation || '',
      englishExplanation: result.englishExplanation || '',
    };
  }
}

export function createTermExplainer(config: OpenAIConfig): TermExplainer {
  return new TermExplainer(config);
}
