export interface HighlightRange {
  start: number;
  end: number;
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Find all matching ranges of keywords in the text using String.indexOf.
 * Case-sensitive matching. Empty string keywords are filtered out.
 */
export function findHighlightRanges(text: string, keywords: string[]): HighlightRange[] {
  const ranges: HighlightRange[] = [];

  for (const keyword of keywords) {
    if (keyword === '') continue;

    let index = text.indexOf(keyword);
    while (index !== -1) {
      ranges.push({ start: index, end: index + keyword.length });
      index = text.indexOf(keyword, index + 1);
    }
  }

  return ranges;
}

/**
 * Merge overlapping or adjacent ranges into non-overlapping sorted ranges.
 */
export function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const first = sorted[0]!;
  const merged: HighlightRange[] = [{ start: first.start, end: first.end }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
}

/**
 * Split text into segments based on merged highlight ranges.
 * Each segment is marked as highlighted or not.
 * Expects already-merged (non-overlapping, sorted) ranges as input.
 */
export function splitTextByRanges(text: string, ranges: HighlightRange[]): TextSegment[] {
  if (ranges.length === 0) {
    return text.length > 0 ? [{ text, highlighted: false }] : [];
  }

  const segments: TextSegment[] = [];
  let pos = 0;

  for (const range of ranges) {
    if (pos < range.start) {
      segments.push({ text: text.substring(pos, range.start), highlighted: false });
    }
    segments.push({ text: text.substring(range.start, range.end), highlighted: true });
    pos = range.end;
  }

  if (pos < text.length) {
    segments.push({ text: text.substring(pos), highlighted: false });
  }

  return segments;
}
