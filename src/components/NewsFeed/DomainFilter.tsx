/**
 * DomainFilter 组件
 * 领域筛选栏，支持按 AI、科技、经济、国际政治四个领域筛选新闻
 */

import React from 'react';
import type { NewsDomain } from '../../types/news';
import { DOMAIN_LABELS } from '../../types/news';

interface DomainFilterProps {
  /** Currently selected domain, null means no filter */
  selectedDomain: NewsDomain | null;
  /** Callback when a domain filter is toggled */
  onDomainChange: (domain: NewsDomain | null) => void;
}

export function DomainFilter({ selectedDomain, onDomainChange }: DomainFilterProps): React.ReactElement {
  const handleClick = (domain: NewsDomain) => {
    onDomainChange(selectedDomain === domain ? null : domain);
  };

  return (
    <div className="news-feed__filters">
      {(Object.keys(DOMAIN_LABELS) as NewsDomain[]).map((domain) => (
        <button
          key={domain}
          className={`news-feed__filter-btn ${selectedDomain === domain ? 'news-feed__filter-btn--active' : ''}`}
          onClick={() => handleClick(domain)}
        >
          {DOMAIN_LABELS[domain]}
        </button>
      ))}
    </div>
  );
}

export default DomainFilter;
