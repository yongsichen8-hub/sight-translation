/**
 * 语境原句提取工具函数
 * 从英文文本中提取包含指定术语的完整句子
 */

/**
 * Extract the complete sentence containing the given term from English text.
 * - A sentence ends with `.`, `!`, or `?`
 * - If the term appears in multiple sentences, return the first one
 * - If the term is not found, return an empty string
 */
export function extractSentenceContext(text: string, term: string): string {
  if (!text || !term) {
    return '';
  }

  // Split text into sentences by sentence-ending punctuation
  // Keep the punctuation attached to the sentence
  const sentences = text.match(/[^.!?]*[.!?]/g);

  if (!sentences) {
    // No sentence-ending punctuation found; check if the whole text contains the term
    if (text.toLowerCase().includes(term.toLowerCase())) {
      return text.trim();
    }
    return '';
  }

  const termLower = term.toLowerCase();

  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(termLower)) {
      return sentence.trim();
    }
  }

  return '';
}
