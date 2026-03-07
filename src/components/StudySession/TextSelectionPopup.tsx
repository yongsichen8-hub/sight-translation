/**
 * TextSelectionPopup 组件
 * 用户在英文面板中划选文本后，在选区附近弹出"收藏为术语"按钮
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './TermCollection.css';

export interface TextSelectionData {
  /** 划选的英文文本 */
  selectedText: string;
  /** 包含划选文本的语境原句 */
  contextSentence: string;
}

export interface TextSelectionPopupProps {
  /** 英文正文容器的 ref，用于限定监听范围 */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 完整英文正文（纯文本），用于提取语境原句 */
  englishPlainText: string;
  /** 用户点击"收藏为术语"后的回调 */
  onCollect: (data: TextSelectionData) => void;
}

/**
 * 从英文文本中提取包含指定术语的完整句子。
 * 按 . ! ? 分句，返回包含 term 的第一个句子。
 */
export function extractSentenceContext(text: string, term: string): string {
  if (!text || !term) return '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  const match = sentences.find((s) => s.includes(term));
  return match?.trim() || term;
}

export function TextSelectionPopup({
  containerRef,
  englishPlainText,
  onCollect,
}: TextSelectionPopupProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const popupRef = useRef<HTMLButtonElement>(null);

  const handleMouseUp = useCallback(() => {
    // Small delay to let the browser finalize the selection
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setVisible(false);
        return;
      }

      const text = selection.toString().trim();
      if (!text || !containerRef.current) {
        setVisible(false);
        return;
      }

      // Ensure the selection is within the English content container
      const range = selection.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        setVisible(false);
        return;
      }

      // Position the popup near the selection
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setSelectedText(text);
      setPosition({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
      });
      setVisible(true);
    });
  }, [containerRef]);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    },
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, handleMouseUp, handleClickOutside]);

  const handleCollect = () => {
    const contextSentence = extractSentenceContext(englishPlainText, selectedText);
    onCollect({ selectedText, contextSentence });
    setVisible(false);
    window.getSelection()?.removeAllRanges();
  };

  if (!visible || !selectedText) return null;

  return (
    <button
      ref={popupRef}
      className="text-selection-popup"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={handleCollect}
      type="button"
      aria-label={`收藏 "${selectedText}" 为术语`}
    >
      ⭐ 收藏为术语
    </button>
  );
}

export default TextSelectionPopup;
