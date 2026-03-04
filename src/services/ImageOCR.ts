/**
 * ImageOCR 服务
 * 使用 OpenAI Vision API 识别图片中的文字
 * 自动将繁体中文转换为简体中文
 */

import type { OpenAIConfig, APIProvider } from '../types';
import { smartConvert } from './ChineseConverter';

export interface IOcrService {
  /**
   * 识别图片中的文字
   * @param imageFile 图片文件
   * @returns 识别出的文字内容
   */
  recognize(imageFile: File): Promise<string>;
}

/**
 * 根据 baseUrl 推断 API 提供商
 */
function detectProvider(baseUrl: string): APIProvider {
  if (baseUrl.includes('bigmodel.cn')) return 'zhipu';
  if (baseUrl.includes('deepseek.com')) return 'deepseek';
  if (baseUrl.includes('dashscope')) return 'qwen';
  if (baseUrl.includes('openai.com')) return 'openai';
  return 'custom';
}

/**
 * 获取视觉模型名称
 */
function getVisionModel(config: OpenAIConfig): string {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const provider = detectProvider(baseUrl);
  
  // 如果用户指定了模型，优先使用
  if (config.model) {
    return config.model;
  }
  
  // 使用提供商的默认视觉模型
  const providers: Record<APIProvider, { visionModel: string }> = {
    openai: { visionModel: 'gpt-4o-mini' },
    zhipu: { visionModel: 'glm-4v-flash' },
    deepseek: { visionModel: 'deepseek-chat' },
    qwen: { visionModel: 'qwen-vl-plus' },
    custom: { visionModel: 'gpt-4o-mini' },
  };
  
  return providers[provider].visionModel;
}

export class ImageOCR implements IOcrService {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    // 确保使用传入的配置，只有在未提供时才使用默认值
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
    };
  }

  async recognize(imageFile: File): Promise<string> {
    // 将图片转换为 base64
    const base64 = await this.fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';
    const visionModel = getVisionModel(this.config);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please extract all text from this image. 
Rules:
1. Extract both Chinese and English text if present
2. Maintain the original layout and paragraph structure as much as possible
3. Return only the extracted text, no explanations
4. If there are multiple columns, read from left to right, top to bottom`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No text recognized from image');
    }

    // 自动将繁体中文转换为简体中文
    return smartConvert(content);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export function createImageOCR(config: OpenAIConfig): ImageOCR {
  return new ImageOCR(config);
}
