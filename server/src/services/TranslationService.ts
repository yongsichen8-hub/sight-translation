import { config } from '../config';

export class TranslationService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    apiKey: string = config.news.openaiApiKey,
    baseUrl: string = config.news.openaiBaseUrl,
    model: string = config.news.chatModel
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * 批量翻译中文标题为英文。
   * 翻译失败时使用中文标题作为 fallback。
   */
  async translateTitles(titles: string[]): Promise<string[]> {
    if (titles.length === 0) {
      return [];
    }

    try {
      const numberedTitles = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator. Translate the following Chinese news titles to English. ' +
                'Return ONLY the translated titles, one per line, numbered to match the input. ' +
                'Keep the same numbering format (e.g. "1. translated title"). ' +
                'Do not add any extra explanation.',
            },
            {
              role: 'user',
              content: numberedTitles,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error(`Translation API error: ${response.status} ${response.statusText}`);
        return [...titles];
      }

      const data = await response.json();
      const content: string = data.choices?.[0]?.message?.content ?? '';

      return this.parseTranslatedTitles(content, titles);
    } catch (error) {
      console.error('Translation failed, using Chinese titles as fallback:', error);
      return [...titles];
    }
  }

  /**
   * 解析 LLM 返回的编号翻译结果，将其映射回原始标题顺序。
   * 无法解析的条目使用原始中文标题作为 fallback。
   */
  private parseTranslatedTitles(content: string, originalTitles: string[]): string[] {
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    const result = [...originalTitles]; // start with fallback

    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s*(.+)$/);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        const translated = match[2].trim();
        if (index >= 0 && index < originalTitles.length && translated) {
          result[index] = translated;
        }
      }
    }

    return result;
  }
}
