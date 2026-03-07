/**
 * NewsFeed 组件
 * 每日双语新闻列表页，展示 Top 10 新闻条目
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loading, Toast } from '../common';
import type { NewsItem, NewsDomain } from '../../types/news';
import { DomainFilter } from './DomainFilter';
import { NewsCard } from './NewsCard';
import './NewsFeed.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface NewsFeedProps {
  /** Date in YYYY-MM-DD format; defaults to today */
  date?: string;
  /** Callback when a news item is selected for detail view */
  onSelectItem?: (item: NewsItem) => void;
}

function getTodayDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function NewsFeed({ date, onSelectItem }: NewsFeedProps): React.ReactElement {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<NewsDomain | null>(null);

  const currentDate = date || getTodayDate();

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ date: currentDate });
      if (selectedDomain) {
        params.set('domain', selectedDomain);
      }

      const res = await fetch(`${API_BASE_URL}/api/news/daily?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || '获取新闻失败');
      }

      setItems(data.data.items ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取新闻失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [currentDate, selectedDomain]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filteredItems = selectedDomain
    ? items.filter(
        (item) =>
          item.domain === selectedDomain ||
          item.secondaryDomains.includes(selectedDomain)
      )
    : items;

  if (loading) return <Loading text="加载新闻..." />;

  if (error) {
    return (
      <div className="news-feed">
        <div className="news-feed__error">
          <p>{error}</p>
          <button className="news-feed__retry-btn" onClick={fetchNews}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-feed">
      <div className="news-feed__header">
        <h1 className="news-feed__title">每日新闻</h1>
        <span className="news-feed__date">{currentDate}</span>
      </div>

      {/* Domain filter */}
      <DomainFilter selectedDomain={selectedDomain} onDomainChange={setSelectedDomain} />

      {/* News list */}
      {filteredItems.length === 0 ? (
        <div className="news-feed__empty">
          <div className="news-feed__empty-icon">📰</div>
          <p>暂无新闻数据</p>
        </div>
      ) : (
        <ul className="news-feed__list">
          {filteredItems.map((item) => (
            <NewsCard key={item.id} item={item} onClick={onSelectItem} />
          ))}
        </ul>
      )}

      {toast && (
        <Toast visible message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default NewsFeed;
