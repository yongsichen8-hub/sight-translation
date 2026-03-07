/**
 * NewsEntryCard 组件
 * 单条新闻卡片，展示中英标题、摘要、来源信息和精读按钮
 */

import React from 'react';
import type { NewsEntry } from '../../types/briefing';

interface NewsEntryCardProps {
  entry: NewsEntry;
  onStudy: (entry: NewsEntry) => void;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NewsEntryCard({ entry, onStudy }: NewsEntryCardProps): React.ReactElement {
  return (
    <div className="news-entry-card">
      <div className="news-entry-card__titles">
        <h3 className="news-entry-card__title-zh">{entry.chineseTitle}</h3>
        <p className="news-entry-card__title-en">{entry.englishTitle}</p>
      </div>

      <p className="news-entry-card__summary">{entry.summary}</p>

      <div className="news-entry-card__footer">
        <div className="news-entry-card__meta">
          <span className="news-entry-card__source">{entry.sourceName}</span>
          <span className="news-entry-card__time">{formatTime(entry.publishedAt)}</span>
        </div>
        <button
          className="news-entry-card__study-btn"
          onClick={() => onStudy(entry)}
          aria-label={`精读: ${entry.chineseTitle}`}
        >
          精读
        </button>
      </div>
    </div>
  );
}

export default NewsEntryCard;
