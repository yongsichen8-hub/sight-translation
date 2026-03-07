/**
 * FlashcardCard 组件
 * 单张 Flashcard 卡片，显示中文考英文
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../common';
import type { Expression, Flashcard } from '../../types';
import { REVIEW_INTERVALS } from '../../types';
import './FlashcardCard.css';

export interface FlashcardCardProps {
  expression: Expression;
  flashcard: Flashcard;
  onRemembered: () => void;
  onForgot: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function getNextIntervalText(currentInterval: number, remembered: boolean): string {
  if (remembered) {
    const nextInterval = Math.min(currentInterval + 1, REVIEW_INTERVALS.length - 1);
    const days = REVIEW_INTERVALS[nextInterval];
    return `${days} 天后`;
  }
  return '明天';
}

export function FlashcardCard({
  expression,
  flashcard,
  onRemembered,
  onForgot,
  onDelete,
  disabled = false,
}: FlashcardCardProps): React.ReactElement {
  const [showAnswer, setShowAnswer] = useState(false);

  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleRemembered = useCallback(() => {
    onRemembered();
    setShowAnswer(false);
  }, [onRemembered]);

  const handleForgot = useCallback(() => {
    onForgot();
    setShowAnswer(false);
  }, [onForgot]);

  const handleDelete = useCallback(() => {
    onDelete();
    setShowAnswer(false);
  }, [onDelete]);

  return (
    <div className="flashcard-card">
      <div className="flashcard-card__header">
        <span className="flashcard-card__language-tag">中文 → 英文</span>
        <span className="flashcard-card__review-count">已复习 {flashcard.reviewCount} 次</span>
      </div>

      <div className="flashcard-card__content">
        {/* 问题：中文 */}
        <div className="flashcard-card__section">
          <div className="flashcard-card__label">中文</div>
          <div className="flashcard-card__text flashcard-card__text--question">
            {expression.chinese}
          </div>
        </div>

        {/* 答案区域 */}
        <div className="flashcard-card__answer-area">
          {showAnswer ? (
            <div className="flashcard-card__section">
              <div className="flashcard-card__label">英文</div>
              <div className="flashcard-card__text flashcard-card__text--answer">
                {expression.english}
              </div>
              {expression.notes && (
                <div className="flashcard-card__notes">
                  <span className="flashcard-card__notes-label">备注：</span>
                  {expression.notes}
                </div>
              )}
            </div>
          ) : (
            <Button variant="secondary" onClick={handleShowAnswer} disabled={disabled} fullWidth>
              显示答案
            </Button>
          )}
        </div>
      </div>

      {/* 操作按钮 - 只在显示答案后出现 */}
      {showAnswer && (
        <div className="flashcard-card__actions">
          <div className="flashcard-card__action-group">
            <Button variant="danger" onClick={handleForgot} disabled={disabled}>
              忘记了 😅
            </Button>
            <span className="flashcard-card__action-hint">
              下次：{getNextIntervalText(flashcard.currentInterval, false)}
            </span>
          </div>
          <div className="flashcard-card__action-group">
            <button className="flashcard-card__delete-btn" onClick={handleDelete} disabled={disabled}>
              🗑 删除
            </button>
          </div>
          <div className="flashcard-card__action-group">
            <Button variant="primary" onClick={handleRemembered} disabled={disabled}>
              记住了 ✓
            </Button>
            <span className="flashcard-card__action-hint">
              下次：{getNextIntervalText(flashcard.currentInterval, true)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardCard;
