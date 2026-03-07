/**
 * NewsCard 组件
 * 单条新闻卡片，展示主题摘要、领域标签、来源信息
 */

import React from 'react';
import type { NewsItem } from '../../types/news';
import { DOMAIN_LABELS } from '../../types/news';

export interface NewsCardProps {
  item: NewsItem;
  onClick?: ((item: NewsItem) => void) | undefined;
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

function getPairingLabel(status: NewsItem['pairingStatus']): string | null {
  if (status === 'zh-only') return '仅中文';
  if (status === 'en-only') return '仅英文';
  return null;
}

export function NewsCard({ item, onClick }: NewsCardProps): React.ReactElement {
  const pairingLabel = getPairingLabel(item.pairingStatus);

  return (
    <li className="news-feed__card" onClick={() => onClick?.(item)}>
      <div className="news-feed__card-header">
        <span className={`news-feed__domain-tag news-feed__domain-tag--${item.domain}`}>
          {DOMAIN_LABELS[item.domain]}
        </span>
        {pairingLabel && (
          <span className="news-feed__pairing-tag">{pairingLabel}</span>
        )}
        <span className="news-feed__time">{formatTime(item.createdAt)}</span>
      </div>

      <h2 className="news-feed__card-title">{item.topicSummary}</h2>

      <div className="news-feed__sources">
        {item.chineseArticle && (
          <div className="news-feed__source">
            <span className="news-feed__source-lang">中</span>
            <span className="news-feed__source-name">{item.chineseArticle.sourceName}</span>
            <span className="news-feed__source-time">{formatTime(item.chineseArticle.publishedAt)}</span>
            <a
              className="news-feed__source-link"
              href={item.chineseArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              原文
            </a>
          </div>
        )}
        {item.englishArticle && (
          <div className="news-feed__source">
            <span className="news-feed__source-lang">EN</span>
            <span className="news-feed__source-name">{item.englishArticle.sourceName}</span>
            <span className="news-feed__source-time">{formatTime(item.englishArticle.publishedAt)}</span>
            <a
              className="news-feed__source-link"
              href={item.englishArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              原文
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

export default NewsCard;
