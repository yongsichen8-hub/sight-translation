/**
 * ComparisonView 组件
 * 双栏对照视图：左栏中文原文，右栏英文原文，两栏独立滚动
 * 支持术语划选收藏和已收藏术语高亮
 */

import React from 'react';
import { ChinesePanel } from './ChinesePanel';
import { EnglishPanel } from './EnglishPanel';
import type { TextSelectionData } from './TextSelectionPopup';

interface ComparisonViewProps {
  chineseTitle: string;
  chineseContent: string;
  status: 'pending' | 'completed';
  englishContent: string | null;
  englishHtmlContent: string | null;
  englishSourceName: string | null;
  englishUrl: string | null;
  extractLoading: boolean;
  extractError: string | null;
  onSubmitUrl: (url: string) => void;
  onManualPaste: (text: string) => void;
  /** 已收藏的术语英文列表 */
  savedTerms?: string[];
  /** 用户划选文本后点击"收藏为术语"的回调 */
  onTermSelect?: (data: TextSelectionData) => void;
}

export function ComparisonView({
  chineseTitle,
  chineseContent,
  status,
  englishContent,
  englishHtmlContent,
  englishSourceName,
  englishUrl,
  extractLoading,
  extractError,
  onSubmitUrl,
  onManualPaste,
  savedTerms,
  onTermSelect,
}: ComparisonViewProps): React.ReactElement {
  return (
    <div className="comparison-view">
      <div className="comparison-view__panel comparison-view__panel--left">
        <ChinesePanel title={chineseTitle} content={chineseContent} />
      </div>
      <div className="comparison-view__panel comparison-view__panel--right">
        <EnglishPanel
          status={status}
          englishContent={englishContent}
          englishHtmlContent={englishHtmlContent}
          englishSourceName={englishSourceName}
          englishUrl={englishUrl}
          extractLoading={extractLoading}
          extractError={extractError}
          onSubmitUrl={onSubmitUrl}
          onManualPaste={onManualPaste}
          savedTerms={savedTerms}
          onTermSelect={onTermSelect}
        />
      </div>
    </div>
  );
}
