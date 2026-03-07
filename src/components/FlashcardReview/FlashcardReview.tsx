/**
 * FlashcardReview 组件
 * Flashcard 复习视图，基于艾宾浩斯记忆曲线进行间隔复习
 * 显示中文，考核英文
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Loading, Toast } from '../common';
import { FlashcardCard } from './FlashcardCard.tsx';
import { dataService } from '../../services/DataService';
import { useAppActions } from '../../context/useAppActions';
import type { Flashcard, Expression } from '../../types';
import './FlashcardReview.css';

interface FlashcardWithExpression {
  flashcard: Flashcard;
  expression: Expression;
}

export function FlashcardReview(): React.ReactElement {
  const [dueCards, setDueCards] = useState<FlashcardWithExpression[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const { goToProjects, goToGlossary } = useAppActions();

  const loadDueCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const flashcards = await dataService.getDueFlashcards();
      const expressions = await dataService.getExpressions();
      const expressionMap = new Map(expressions.map(e => [e.id, e]));

      const cardsWithExpressions: FlashcardWithExpression[] = [];
      for (const flashcard of flashcards) {
        const expression = expressionMap.get(flashcard.expressionId);
        if (expression) {
          cardsWithExpressions.push({ flashcard, expression });
        }
      }

      setDueCards(cardsWithExpressions);
      setCurrentIndex(0);
    } catch (err) {
      setError('加载复习卡片失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  const handleReview = useCallback(async (remembered: boolean) => {
    if (currentIndex >= dueCards.length || reviewing) return;
    const currentCard = dueCards[currentIndex];
    if (!currentCard) return;

    try {
      setReviewing(true);
      await dataService.recordReview(currentCard.flashcard.id, remembered);
      setToast({
        message: remembered ? '太棒了！🎉' : '没关系，明天再复习 💪',
        type: 'success',
      });
      setCurrentIndex((prev) => prev + 1);
    } catch {
      setToast({ message: '记录失败，请重试', type: 'error' });
    } finally {
      setReviewing(false);
    }
  }, [currentIndex, dueCards, reviewing]);

  const handleDelete = useCallback(async () => {
    if (currentIndex >= dueCards.length || reviewing) return;
    const currentCard = dueCards[currentIndex];
    if (!currentCard) return;

    try {
      setReviewing(true);
      await dataService.deleteExpression(currentCard.expression.id);
      setToast({ message: '术语已删除', type: 'success' });
      // 从列表中移除当前卡片
      setDueCards(prev => prev.filter((_, i) => i !== currentIndex));
      // 如果删除的不是最后一张，index 不变（下一张自动顶上来）
      // 如果删除的是最后一张，index 需要回退
      if (currentIndex >= dueCards.length - 1) {
        setCurrentIndex(prev => Math.max(0, prev));
      }
    } catch {
      setToast({ message: '删除失败，请重试', type: 'error' });
    } finally {
      setReviewing(false);
    }
  }, [currentIndex, dueCards, reviewing]);

  if (loading) return <Loading text="加载复习卡片..." />;

  if (error) {
    return (
      <div className="flashcard-review">
        <div className="flashcard-review__empty">
          <p>{error}</p>
          <Button onClick={loadDueCards}>重新加载</Button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];
  const totalCards = dueCards.length;

  return (
    <div className="flashcard-review">
      <div className="flashcard-review__header">
        <h1 className="flashcard-review__title">Flashcard 复习</h1>
        <div className="flashcard-review__nav">
          <Button variant="ghost" onClick={goToGlossary}>术语库</Button>
          <Button variant="secondary" onClick={goToProjects}>返回项目</Button>
        </div>
      </div>

      <div className="flashcard-review__stats">
        <div className="flashcard-review__stat">
          <span className="flashcard-review__stat-value">{totalCards}</span>
          <span className="flashcard-review__stat-label">今日待复习</span>
        </div>
        <div className="flashcard-review__stat">
          <span className="flashcard-review__stat-value">{currentIndex}</span>
          <span className="flashcard-review__stat-label">已完成</span>
        </div>
        <div className="flashcard-review__stat">
          <span className="flashcard-review__stat-value">{totalCards - currentIndex}</span>
          <span className="flashcard-review__stat-label">剩余</span>
        </div>
      </div>

      {totalCards === 0 ? (
        <div className="flashcard-review__empty">
          <div className="flashcard-review__empty-icon">🎉</div>
          <p>今天没有待复习的卡片，去术语库添加一些术语吧！</p>
          <Button onClick={goToGlossary}>查看术语库</Button>
        </div>
      ) : currentIndex >= totalCards ? (
        <div className="flashcard-review__empty">
          <div className="flashcard-review__empty-icon">✅</div>
          <p>太棒了！今天的复习已全部完成，共复习了 {totalCards} 张卡片。</p>
          <Button onClick={() => loadDueCards()}>重新加载</Button>
        </div>
      ) : (
        <>
          <div className="flashcard-review__progress">
            <div className="flashcard-review__progress-bar" style={{ width: `${(currentIndex / totalCards) * 100}%` }} />
          </div>
          {currentCard && (
            <FlashcardCard
              expression={currentCard.expression}
              flashcard={currentCard.flashcard}
              onRemembered={() => handleReview(true)}
              onForgot={() => handleReview(false)}
              onDelete={handleDelete}
              disabled={reviewing}
            />
          )}
        </>
      )}

      {toast && <Toast visible message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default FlashcardReview;
