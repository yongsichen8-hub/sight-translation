import { describe, it, expect } from 'vitest';
import { extractSentenceContext } from '../contextExtractor';

describe('extractSentenceContext', () => {
  it('extracts the sentence containing the term', () => {
    const text = 'The market is volatile. Inflation rates have risen sharply. Investors are cautious.';
    expect(extractSentenceContext(text, 'Inflation')).toBe('Inflation rates have risen sharply.');
  });

  it('returns the first sentence when term appears in multiple sentences', () => {
    const text = 'AI is transforming industries. AI will continue to grow. AI is everywhere.';
    expect(extractSentenceContext(text, 'AI')).toBe('AI is transforming industries.');
  });

  it('performs case-insensitive matching', () => {
    const text = 'The economy is growing. Trade policies affect markets.';
    expect(extractSentenceContext(text, 'trade')).toBe('Trade policies affect markets.');
  });

  it('returns empty string when term is not found', () => {
    const text = 'The weather is nice today.';
    expect(extractSentenceContext(text, 'blockchain')).toBe('');
  });

  it('returns empty string for empty text', () => {
    expect(extractSentenceContext('', 'term')).toBe('');
  });

  it('returns empty string for empty term', () => {
    expect(extractSentenceContext('Some text here.', '')).toBe('');
  });

  it('handles sentences ending with exclamation marks', () => {
    const text = 'What a breakthrough! The new chip is revolutionary.';
    expect(extractSentenceContext(text, 'breakthrough')).toBe('What a breakthrough!');
  });

  it('handles sentences ending with question marks', () => {
    const text = 'Is inflation under control? The Fed thinks so.';
    expect(extractSentenceContext(text, 'inflation')).toBe('Is inflation under control?');
  });

  it('handles text without sentence-ending punctuation containing the term', () => {
    const text = 'A quick note about inflation rates';
    expect(extractSentenceContext(text, 'inflation')).toBe('A quick note about inflation rates');
  });

  it('handles text without sentence-ending punctuation not containing the term', () => {
    const text = 'A quick note about markets';
    expect(extractSentenceContext(text, 'inflation')).toBe('');
  });
});
