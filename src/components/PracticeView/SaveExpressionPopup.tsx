/**
 * SaveExpressionPopup 组件
 * 保存术语的弹出框，支持编辑中英文和备注
 */

import React, { useState, useRef, useEffect } from 'react';
import './SaveExpressionPopup.css';

export interface SaveExpressionPopupProps {
  /** 选中的文本 */
  selectedText: string;
  /** 源语言 (zh 或 en) */
  sourceLanguage: 'zh' | 'en';
  /** 弹出框位置 */
  position: { x: number; y: number };
  /** 保存回调 */
  onSave: (data: { chinese: string; english: string; notes: string }) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在保存 */
  saving?: boolean;
}

/**
 * 检测文本是否主要是中文
 */
function isChinese(text: string): boolean {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  return chineseChars / text.length > 0.3;
}

export function SaveExpressionPopup({
  selectedText,
  sourceLanguage,
  position,
  onSave,
  onCancel,
  saving = false,
}: SaveExpressionPopupProps) {
  // 根据源语言初始化中英文字段
  const isZh = sourceLanguage === 'zh' || isChinese(selectedText);
  const [chinese, setChinese] = useState(isZh ? selectedText : '');
  const [english, setEnglish] = useState(isZh ? '' : selectedText);
  const [notes, setNotes] = useState('');
  
  const popupRef = useRef<HTMLDivElement>(null);
  const translationRef = useRef<HTMLInputElement>(null);

  // 自动聚焦到需要填写的翻译字段
  useEffect(() => {
    translationRef.current?.focus();
  }, []);

  // 调整弹出框位置
  useEffect(() => {
    if (popupRef.current) {
      const popup = popupRef.current;
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth - 16) {
        popup.style.left = `${viewportWidth - rect.width - 16}px`;
      }
      if (rect.bottom > viewportHeight - 16) {
        popup.style.top = `${position.y - rect.height - 8}px`;
      }
    }
  }, [position]);

  const handleSave = () => {
    if (!chinese.trim() || !english.trim()) return;
    onSave({ chinese: chinese.trim(), english: english.trim(), notes: notes.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const canSave = chinese.trim() && english.trim();

  return (
    <>
      <div className="save-expression-overlay" onClick={onCancel} aria-hidden="true" />

      <div
        ref={popupRef}
        className="save-expression-popup"
        style={{ left: position.x, top: position.y }}
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
      >
        <div className="save-expression-popup__header">
          <h3 className="save-expression-popup__title">保存术语</h3>
          <button
            type="button"
            className="save-expression-popup__close"
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="save-expression-popup__form">
          <div className="save-expression-popup__field">
            <label className="save-expression-popup__label">中文</label>
            <input
              type="text"
              className="save-expression-popup__input"
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              placeholder="输入中文术语"
              ref={isZh ? undefined : translationRef}
            />
          </div>

          <div className="save-expression-popup__field">
            <label className="save-expression-popup__label">英文</label>
            <input
              type="text"
              className="save-expression-popup__input"
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              placeholder="输入英文术语"
              ref={isZh ? translationRef : undefined}
            />
          </div>

          <div className="save-expression-popup__field">
            <label className="save-expression-popup__label">备注（可选）</label>
            <textarea
              className="save-expression-popup__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="添加备注..."
              rows={2}
            />
          </div>
        </div>

        <div className="save-expression-popup__actions">
          <button
            type="button"
            className="save-expression-popup__cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="save-expression-popup__save"
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
}

export default SaveExpressionPopup;
