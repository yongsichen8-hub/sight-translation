/**
 * DomainSection 组件
 * 单个领域的新闻条目列表，按领域分组展示
 */

import React from 'react';
import type { NewsEntry } from '../../types/briefing';
import { NewsEntryCard } from './NewsEntryCard';

interface DomainSectionProps {
  label: string;
  entries: NewsEntry[];
  onStudy: (entry: NewsEntry) => void;
}

export function DomainSection({ label, entries, onStudy }: DomainSectionProps): React.ReactElement {
  return (
    <section className="domain-section">
      <h2 className="domain-section__title">{label}</h2>
      <div className="domain-section__cards">
        {entries.map((entry) => (
          <NewsEntryCard key={entry.id} entry={entry} onStudy={onStudy} />
        ))}
      </div>
    </section>
  );
}

export default DomainSection;
