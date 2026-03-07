/**
 * TermFilters 组件
 * 领域筛选下拉 + 关键词搜索输入框
 */

import React, { useState, useCallback } from 'react';
import type { BriefingDomain, TermFilters as TermFiltersType } from '../../types/briefing';
import { BRIEFING_DOMAIN_LABELS } from '../../types/briefing';

interface TermFiltersProps {
  filters: TermFiltersType;
  onFilterChange: (filters: TermFiltersType) => void;
}

const DOMAIN_OPTIONS: { value: '' | BriefingDomain; label: string }[] = [
  { value: '', label: '全部领域' },
  { value: 'ai-tech', label: BRIEFING_DOMAIN_LABELS['ai-tech'] },
  { value: 'economy', label: BRIEFING_DOMAIN_LABELS['economy'] },
  { value: 'politics', label: BRIEFING_DOMAIN_LABELS['politics'] },
  { value: 'auto', label: BRIEFING_DOMAIN_LABELS['auto'] },
];

export function TermFilters({ filters, onFilterChange }: TermFiltersProps): React.ReactElement {
  const [keyword, setKeyword] = useState(filters.keyword || '');

  const handleDomainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const domain = e.target.value as BriefingDomain | '';
      const next: TermFiltersType = { ...filters };
      if (domain) {
        next.domain = domain;
      } else {
        delete next.domain;
      }
      onFilterChange(next);
    },
    [filters, onFilterChange]
  );

  const handleKeywordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKeyword(e.target.value);
    },
    []
  );

  const handleKeywordSubmit = useCallback(
    (e: React.FormEvent | React.KeyboardEvent) => {
      e.preventDefault();
      const next: TermFiltersType = { ...filters };
      const trimmed = keyword.trim();
      if (trimmed) {
        next.keyword = trimmed;
      } else {
        delete next.keyword;
      }
      onFilterChange(next);
    },
    [filters, keyword, onFilterChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleKeywordSubmit(e);
      }
    },
    [handleKeywordSubmit]
  );

  return (
    <div className="term-filters">
      <select
        className="term-filters__domain-select"
        value={filters.domain || ''}
        onChange={handleDomainChange}
        aria-label="按领域筛选"
      >
        {DOMAIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="term-filters__search">
        <input
          className="term-filters__search-input"
          type="text"
          placeholder="搜索术语..."
          value={keyword}
          onChange={handleKeywordChange}
          onKeyDown={handleKeyDown}
          onBlur={handleKeywordSubmit}
          aria-label="搜索术语"
        />
      </div>
    </div>
  );
}

export default TermFilters;
