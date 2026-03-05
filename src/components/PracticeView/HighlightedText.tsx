import React, { useMemo } from 'react';
import { findHighlightRanges, mergeRanges, splitTextByRanges } from './highlightUtils';

export interface HighlightedTextProps {
  /** 原文文本 */
  text: string;
  /** 需要高亮的关键词列表 */
  keywords: string[];
}

/**
 * HighlightedText 组件
 * 对原文中匹配关键词的片段进行浅黄色高亮渲染
 */
export const HighlightedText = React.memo(function HighlightedText({
  text,
  keywords,
}: HighlightedTextProps) {
  const segments = useMemo(() => {
    if (keywords.length === 0) return null;
    const ranges = findHighlightRanges(text, keywords);
    const merged = mergeRanges(ranges);
    return splitTextByRanges(text, merged);
  }, [text, keywords]);

  if (!segments) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index} style={{ backgroundColor: '#FFF9C4', padding: 0 }}>
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </>
  );
});

export default HighlightedText;
