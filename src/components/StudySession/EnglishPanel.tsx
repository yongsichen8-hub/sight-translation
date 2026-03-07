/**
 * EnglishPanel 组件
 * 右栏英文面板：未提取时显示 UrlInputForm，提取后显示英文正文
 * 支持划选术语收藏和已收藏术语高亮
 */

import React, { useRef, useMemo } from 'react';
import { UrlInputForm } from './UrlInputForm';
import { TextSelectionPopup } from './TextSelectionPopup';
import type { TextSelectionData } from './TextSelectionPopup';
import {
  findHighlightRanges,
  mergeRanges,
  splitTextByRanges,
} from '../PracticeView/highlightUtils';
import './TermCollection.css';

interface EnglishPanelProps {
  status: 'pending' | 'completed';
  englishContent: string | null;
  englishHtmlContent: string | null;
  englishSourceName: string | null;
  englishUrl: string | null;
  extractLoading: boolean;
  extractError: string | null;
  onSubmitUrl: (url: string) => void;
  onManualPaste: (text: string) => void;
  /** 已收藏的术语英文列表，用于高亮 */
  savedTerms?: string[];
  /** 用户划选文本后点击"收藏为术语"的回调 */
  onTermSelect?: (data: TextSelectionData) => void;
}

/**
 * 渲染带有术语高亮的段落文本
 */
function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;

  const ranges = findHighlightRanges(text, terms);
  const merged = mergeRanges(ranges);
  const segments = splitTextByRanges(text, merged);

  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <span key={i} className="highlighted-term">{seg.text}</span>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
}

export function EnglishPanel({
  status,
  englishContent,
  englishHtmlContent: _htmlContent,
  englishSourceName,
  englishUrl,
  extractLoading,
  extractError,
  onSubmitUrl,
  onManualPaste,
  savedTerms = [],
  onTermSelect,
}: EnglishPanelProps): React.ReactElement {
  // _htmlContent kept for API compatibility; we render plain text to support term highlighting
  void _htmlContent;
  const contentRef = useRef<HTMLDivElement>(null);

  const plainText = useMemo(() => {
    return englishContent || '';
  }, [englishContent]);

  if (status === 'pending') {
    return (
      <div className="english-panel">
        <div className="english-panel__header">
          <span className="english-panel__label">英文报道</span>
        </div>
        <UrlInputForm
          onSubmitUrl={onSubmitUrl}
          onManualPaste={onManualPaste}
          loading={extractLoading}
          error={extractError}
        />
      </div>
    );
  }

  return (
    <div className="english-panel">
      <div className="english-panel__header">
        <span className="english-panel__label">英文报道</span>
        {englishSourceName && (
          <span className="english-panel__source">
            来源：
            {englishUrl ? (
              <a
                href={englishUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="english-panel__source-link"
              >
                {englishSourceName}
              </a>
            ) : (
              englishSourceName
            )}
          </span>
        )}
      </div>
      <div className="english-panel__content" ref={contentRef} style={{ position: 'relative' }}>
        {englishContent ? (
          englishContent.split('\n').map((paragraph, index) =>
            paragraph.trim() ? (
              <p key={index} className="english-panel__paragraph">
                <HighlightedText text={paragraph} terms={savedTerms} />
              </p>
            ) : null
          )
        ) : null}
        {onTermSelect && (
          <TextSelectionPopup
            containerRef={contentRef}
            englishPlainText={plainText}
            onCollect={onTermSelect}
          />
        )}
      </div>
    </div>
  );
}
