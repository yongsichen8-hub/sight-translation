/**
 * SentenceItem 组件
 * 显示单个句子及其翻译，支持翻译显示/隐藏切换
 */

import React from 'react';
import type { PracticeMode } from '../../context/AppContext';
import './SentenceItem.css';

/**
 * SentenceItem Props 接口
 */
export interface SentenceItemProps {
  /** 句子索引 */
  index: number;
  /** 源语言句子 */
  sourceSentence: string;
  /** 目标语言句子 */
  targetSentence: string;
  /** 练习模式 */
  mode: PracticeMode;
  /** 是否显示翻译 */
  showTranslation: boolean;
  /** 切换翻译显示回调 */
  onToggleTranslation: () => void;
  /** 文本选择回调 */
  onTextSelect?: (selectedText: string, contextSentence: string) => void;
}

/**
 * SentenceItem 组件
 * 逐句显示源语言文本，支持翻译显示/隐藏切换
 */
export function SentenceItem({
  index,
  sourceSentence,
  targetSentence,
  mode,
  showTranslation,
  onToggleTranslation,
  onTextSelect,
}: SentenceItemProps) {
  // 获取按钮文本
  const getButtonText = () => {
    if (showTranslation) {
      return '隐藏翻译';
    }
    return mode === 'zh-to-en' ? '显示英文' : '显示中文';
  };

  // 获取翻译标签
  const getTranslationLabel = () => {
    return mode === 'zh-to-en' ? 'EN' : '中';
  };

  // 处理文本选择
  const handleMouseUp = () => {
    if (!onTextSelect) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0) {
      onTextSelect(selectedText, targetSentence);
    }
  };

  return (
    <div className="sentence-item" data-testid={`sentence-item-${index}`}>
      <div className="sentence-item__content">
        {/* 源语言句子 */}
        <div className="sentence-item__source">
          <span className="sentence-item__index">{index + 1}</span>
          <span className="sentence-item__source-text">{sourceSentence}</span>
          <button
            type="button"
            className={`sentence-item__toggle ${
              showTranslation ? 'sentence-item__toggle--active' : ''
            }`}
            onClick={onToggleTranslation}
            aria-expanded={showTranslation}
            aria-controls={`translation-${index}`}
          >
            {getButtonText()}
          </button>
        </div>

        {/* 翻译区域 */}
        {showTranslation && (
          <div
            id={`translation-${index}`}
            className="sentence-item__translation"
            role="region"
            aria-label="翻译内容"
          >
            <span className="sentence-item__translation-label">
              {getTranslationLabel()}
            </span>
            <span
              className="sentence-item__translation-text"
              onMouseUp={handleMouseUp}
            >
              {targetSentence}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SentenceItem;
