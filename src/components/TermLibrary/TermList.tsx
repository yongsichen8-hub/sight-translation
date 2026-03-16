/**
 * TermList 组件
 * 渲染术语卡片列表，支持批量选择模式
 */

import React from 'react';
import type { Term } from '../../types/briefing';
import { TermCard } from './TermCard';

interface TermListProps {
  terms: Term[];
  selectedTermId: string | null;
  onSelectTerm: (termId: string) => void;
  selectionMode?: boolean;
  checkedIds?: Set<string>;
  onCheckChange?: (termId: string, checked: boolean) => void;
}

export function TermList({ terms, selectedTermId, onSelectTerm, selectionMode, checkedIds, onCheckChange }: TermListProps): React.ReactElement {
  if (terms.length === 0) {
    return (
      <div className="term-list__empty">
        <p className="term-list__empty-text">暂无术语</p>
        <p className="term-list__empty-hint">在研习会话中划选英文术语即可收藏到术语库</p>
      </div>
    );
  }

  return (
    <div className="term-list" role="list">
      {terms.map((term) => (
        <TermCard
          key={term.id}
          term={term}
          isSelected={selectedTermId === term.id}
          onClick={onSelectTerm}
          selectionMode={selectionMode}
          isChecked={checkedIds?.has(term.id)}
          onCheckChange={onCheckChange}
        />
      ))}
    </div>
  );
}

export default TermList;
