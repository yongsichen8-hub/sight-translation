/**
 * NewsDetail 组件
 * 双语并排阅读视图 — 展示中文文章和英文文章的并排视图
 * 明确标注中文文章来源和英文文章来源
 */

import React from 'react';
import type { NewsItem, ArticleRef } from '../../types/news';
import { DOMAIN_LABELS } from '../../types/news';
import './NewsDetail.css';

export interface NewsDetailProps {
  item: NewsItem;
  onBack?: () => void;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
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

interface ArticlePanelProps {
  article: ArticleRef;
  langBadge: string;
  langLabel: string;
}

function ArticlePanel({ article, langBadge, langLabel }: ArticlePanelProps): React.ReactElement {
  return (
    <div className="news-detail__panel">
      <div className="news-detail__panel-lang">
        <span className="news-detail__lang-badge">{langBadge}</span>
        <span className="news-detail__lang-label">{langLabel}</span>
      </div>

      <div className="news-detail__source-info">
        <span className="news-detail__source-name">{article.sourceName}</span>
        <span className="news-detail__source-time">{formatTime(article.publishedAt)}</span>
        <a
          className="news-detail__source-link"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看原文 ↗
        </a>
      </div>

      <h3 className="news-detail__article-title">{article.title}</h3>

      {article.summary && (
        <p className="news-detail__article-summary">{article.summary}</p>
      )}

      {article.content && (
        <p className="news-detail__article-content">{article.content}</p>
      )}
    </div>
  );
}

function MissingPanel({ langLabel }: { langLabel: string }): React.ReactElement {
  return (
    <div className="news-detail__panel news-detail__panel--missing">
      <p>暂无{langLabel}报道</p>
    </div>
  );
}

export function NewsDetail({ item, onBack }: NewsDetailProps): React.ReactElement {
  const pairingLabel = getPairingLabel(item.pairingStatus);

  return (
    <div className="news-detail">
      {onBack && (
        <button className="news-detail__back-btn" onClick={onBack}>
          ← 返回列表
        </button>
      )}

      <div className="news-detail__header">
        <h1 className="news-detail__topic">{item.topicSummary}</h1>
        <div className="news-detail__meta">
          <span className={`news-detail__domain-tag news-detail__domain-tag--${item.domain}`}>
            {DOMAIN_LABELS[item.domain]}
          </span>
          {pairingLabel && (
            <span className="news-detail__pairing-tag">{pairingLabel}</span>
          )}
        </div>
      </div>

      <div className="news-detail__panels">
        {/* Chinese article — left side */}
        {item.chineseArticle ? (
          <ArticlePanel
            article={item.chineseArticle}
            langBadge="中"
            langLabel="中文来源"
          />
        ) : (
          <MissingPanel langLabel="中文" />
        )}

        {/* English article — right side */}
        {item.englishArticle ? (
          <ArticlePanel
            article={item.englishArticle}
            langBadge="EN"
            langLabel="English Source"
          />
        ) : (
          <MissingPanel langLabel="英文" />
        )}
      </div>
    </div>
  );
}

export default NewsDetail;
