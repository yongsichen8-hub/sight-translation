/**
 * ParagraphMatcher 服务
 * 使用 OpenAI API 进行中英文段落的语义匹配
 * 支持分批处理，避免段落过多时 AI 遗漏
 */

import { ParagraphPair, OpenAIConfig } from '../types/models';

export interface IParagraphMatcher {
  match(chineseParagraphs: string[], englishParagraphs: string[]): Promise<ParagraphPair[]>;
}

interface MatchResult {
  pairs: Array<{
    chineseIndex: number;
    englishIndex: number;
  }>;
}

function supportsJsonMode(baseUrl: string): boolean {
  if (baseUrl.includes('openai.com')) return true;
  if (baseUrl.includes('bigmodel.cn')) return true;
  if (baseUrl.includes('deepseek.com')) return true;
  return false;
}

/** 每批最多发给 AI 的段落数（中文+英文各自的数量） */
const BATCH_SIZE = 15;

export class ParagraphMatcher implements IParagraphMatcher {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
    };
  }

  async match(chineseParagraphs: string[], englishParagraphs: string[]): Promise<ParagraphPair[]> {
    // 段落数量相同时直接顺序匹配，无需 AI
    if (chineseParagraphs.length === englishParagraphs.length) {
      return chineseParagraphs.map((zh, i): ParagraphPair => ({
        index: i,
        chinese: zh,
        english: englishParagraphs[i] ?? '',
      }));
    }

    // 段落数量不同时，分批调用 AI 匹配
    return this.batchMatch(chineseParagraphs, englishParagraphs);
  }

  /**
   * 分批匹配：将段落分成小批次，每批独立匹配后合并
   * 利用翻译文本顺序一致的特性，按顺序滑动窗口处理
   */
  private async batchMatch(
    zhParagraphs: string[],
    enParagraphs: string[]
  ): Promise<ParagraphPair[]> {
    const allPairs: ParagraphPair[] = [];
    const usedZh = new Set<number>();
    const usedEn = new Set<number>();

    // 计算批次：以中文段落为基准，每批取 BATCH_SIZE 个中文段落
    // 英文段落按比例取对应范围（加一些重叠以防边界遗漏）
    const zhTotal = zhParagraphs.length;
    const enTotal = enParagraphs.length;
    const ratio = enTotal / zhTotal;

    let zhStart = 0;
    while (zhStart < zhTotal) {
      const zhEnd = Math.min(zhStart + BATCH_SIZE, zhTotal);
      
      // 对应的英文范围（加 20% 的缓冲）
      const enStart = Math.max(0, Math.floor(zhStart * ratio) - 2);
      const enEnd = Math.min(enTotal, Math.ceil(zhEnd * ratio) + 2);

      const zhBatch = zhParagraphs.slice(zhStart, zhEnd);
      const enBatch = enParagraphs.slice(enStart, enEnd);

      try {
        const result = await this.callOpenAI(zhBatch, enBatch);

        // 将批次内的相对索引转换为全局索引
        for (const { chineseIndex, englishIndex } of result.pairs) {
          const globalZh = zhStart + chineseIndex;
          const globalEn = enStart + englishIndex;

          if (
            globalZh < zhTotal &&
            globalEn < enTotal &&
            !usedZh.has(globalZh) &&
            !usedEn.has(globalEn)
          ) {
            allPairs.push({
              index: allPairs.length,
              chinese: zhParagraphs[globalZh] ?? '',
              english: enParagraphs[globalEn] ?? '',
            });
            usedZh.add(globalZh);
            usedEn.add(globalEn);
          }
        }
      } catch (err) {
        console.warn(`Batch match failed for zh[${zhStart}-${zhEnd}], falling back to sequential:`, err);
        // 这批 AI 失败，顺序匹配这批
        for (let i = 0; i < zhBatch.length; i++) {
          const globalZh = zhStart + i;
          const globalEn = enStart + i;
          if (globalEn < enTotal && !usedZh.has(globalZh) && !usedEn.has(globalEn)) {
            allPairs.push({
              index: allPairs.length,
              chinese: zhParagraphs[globalZh] ?? '',
              english: enParagraphs[globalEn] ?? '',
            });
            usedZh.add(globalZh);
            usedEn.add(globalEn);
          }
        }
      }

      zhStart = zhEnd;
    }

    // 将所有未匹配的段落按顺序追加（保证内容不丢失）
    const unmatchedZh = zhParagraphs.map((_, i) => i).filter(i => !usedZh.has(i));
    const unmatchedEn = enParagraphs.map((_, i) => i).filter(i => !usedEn.has(i));
    const minUnmatched = Math.min(unmatchedZh.length, unmatchedEn.length);

    for (let i = 0; i < minUnmatched; i++) {
      const zhIdx = unmatchedZh[i]!;
      const enIdx = unmatchedEn[i]!;
      allPairs.push({
        index: allPairs.length,
        chinese: zhParagraphs[zhIdx] ?? '',
        english: enParagraphs[enIdx] ?? '',
      });
    }

    // 按中文段落的原始顺序排序
    allPairs.sort((a, b) => {
      const aIdx = zhParagraphs.indexOf(a.chinese);
      const bIdx = zhParagraphs.indexOf(b.chinese);
      return aIdx - bIdx;
    });

    // 重新编号
    return allPairs.map((p, i) => ({ ...p, index: i }));
  }

  private async callOpenAI(zhParagraphs: string[], enParagraphs: string[]): Promise<MatchResult> {
    const prompt = this.buildPrompt(zhParagraphs, enParagraphs);
    const useJsonMode = supportsJsonMode(this.config.baseUrl || '');

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: `You are a translation alignment expert. Match Chinese and English paragraphs that are translations of each other.
Return ONLY a JSON object with a "pairs" array. Each pair has "chineseIndex" and "englishIndex" (0-based).
IMPORTANT:
- Match ALL paragraphs, do not skip any
- Each paragraph should be matched exactly once
- Return ONLY valid JSON, no other text`,
        },
        {
          role: 'user',
          content: prompt,
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
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from API');

    try {
      return JSON.parse(content) as MatchResult;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as MatchResult;
      throw new Error('Failed to parse JSON response');
    }
  }

  private buildPrompt(zhParagraphs: string[], enParagraphs: string[]): string {
    let prompt = 'Match ALL of these Chinese and English paragraphs. They are translations of each other.\n\n';

    prompt += 'CHINESE PARAGRAPHS:\n';
    zhParagraphs.forEach((p, i) => {
      prompt += `[ZH-${i}]: ${p.substring(0, 300)}${p.length > 300 ? '...' : ''}\n`;
    });

    prompt += '\nENGLISH PARAGRAPHS:\n';
    enParagraphs.forEach((p, i) => {
      prompt += `[EN-${i}]: ${p.substring(0, 300)}${p.length > 300 ? '...' : ''}\n`;
    });

    prompt += `\nReturn JSON matching ALL ${zhParagraphs.length} Chinese paragraphs to their English translations.`;
    return prompt;
  }
}

export function createParagraphMatcher(config: OpenAIConfig): ParagraphMatcher {
  return new ParagraphMatcher(config);
}
