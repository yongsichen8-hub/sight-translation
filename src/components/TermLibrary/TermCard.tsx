/**
 * TermCard 组件
 * 术语卡片：显示英文术语、中文释义、领域标签和收藏时间
 * 支持选择模式下的复选框
 */

import React from 'react';
import type { Term, BriefingDomain } from '../../types/briefing';
import { BRIEFING_DOMAIN_LABELS } from '../../types/briefing';

interface TermCardProps {
  term: Term;
  isSelected: boolean;
  onClick: (termId: string) => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onCheckChange?: (termId: string, checked: boolean) => void;
}

const DOMAIN_COLORS: Record<BriefingDomain, string> = {
  'ai-tech': '#8b5cf6',
  'economy': '#059669',
  'politics': '#dc2626',
  'auto': '#d97706',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TermCard({ term, isSelected, onClick, selectionMode, isChecked, onCheckChange }: TermCardProps): React.ReactElement {
  return (
    <div className={`term-card ${isSelected ? 'term-card--selected' : ''}`} role="listitem">
      {selectionMode && (
        <input
          type="checkbox"
          className="term-card__checkbox"
          checked={isChecked || false}
          onChange={(e) => {
            e.stopPropagation();
            onCheckChange?.(term.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`选择 ${term.english}`}
        />
      )}
      <button
        className="term-card__button"
        onClick={() => onClick(term.id)}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${term.english} - ${term.chinese}`}
      >
        <div className="term-card__content">
          <span className="term-card__english">{term.english}</span>
          <span className="term-card__chinese">{term.chinese}</span>
        </div>
        <div className="term-card__meta">
          <span
            className="term-card__domain-badge"
            style={{ backgroundColor: DOMAIN_COLORS[term.domain] }}
          >
            {BRIEFING_DOMAIN_LABELS[term.domain]}
          </span>
          <span className="term-card__date">{formatDate(term.createdAt)}</span>
        </div>
      </button>
    </div>
  );
}

export default TermCard;
