/**
 * SentenceList 组件
 * 句子列表，管理多个句子的显示和翻译状态
 */

import React from 'react';
import type { PracticeMode } from '../../context/AppContext';
import { SentenceItem } from './SentenceItem';

/**
 * SentenceList Props 接口
 */
export interface SentenceListProps {
  /** 源语言句子数组 */
  sourceSentences: string[];
  /** 目标语言句子数组 */
  targetSentences: string[];
  /** 练习模式 */
  mode: PracticeMode;
  /** 显示翻译的句子索引集合 */
  visibleTranslations: Set<number>;
  /** 切换翻译显示回调 */
  onToggleTranslation: (index: number) => void;
  /** 文本选择回调 */
  onTextSelect?: (selectedText: string, contextSentence: string) => void;
}

/**
 * SentenceList 组件
 * 渲染句子列表，保持句子对齐
 */
export function SentenceList({
  sourceSentences,
  targetSentences,
  mode,
  visibleTranslations,
  onToggleTranslation,
  onTextSelect,
}: SentenceListProps) {
  // 确保句子数量一致，取较小值
  const sentenceCount = Math.min(sourceSentences.length, targetSentences.length);

  if (sentenceCount === 0) {
    return (
      <div className="practice-view__empty">
        <p>暂无句子可显示</p>
      </div>
    );
  }

  return (
    <div className="sentence-list" role="list" aria-label="句子列表">
      {Array.from({ length: sentenceCount }, (_, index) => (
        <SentenceItem
          key={index}
          index={index}
          sourceSentence={sourceSentences[index]}
          targetSentence={targetSentences[index]}
          mode={mode}
          showTranslation={visibleTranslations.has(index)}
          onToggleTranslation={() => onToggleTranslation(index)}
          onTextSelect={onTextSelect}
        />
      ))}
    </div>
  );
}

export default SentenceList;
