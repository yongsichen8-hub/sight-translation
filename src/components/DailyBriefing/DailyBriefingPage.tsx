/**
 * DailyBriefingPage 组件
 * 简报首页容器，管理日期状态，按领域分组展示每日新闻简报
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loading } from '../common';
import type { NewsEntry, DailyBriefing, BriefingDomain } from '../../types/briefing';
import { BRIEFING_DOMAIN_LABELS } from '../../types/briefing';
import { briefingApiClient } from '../../services/BriefingApiClient';
import { DomainSection } from './DomainSection';
import { DatePicker } from './DatePicker';
import './DailyBriefing.css';

interface DailyBriefingPageProps {
  onStudy?: (entry: NewsEntry) => void;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupByDomain(entries: NewsEntry[]): Map<BriefingDomain, NewsEntry[]> {
  const groups = new Map<BriefingDomain, NewsEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.domain) || [];
    list.push(entry);
    groups.set(entry.domain, list);
  }
  return groups;
}

const DOMAIN_ORDER: BriefingDomain[] = ['ai-tech', 'economy', 'politics'];

export function DailyBriefingPage({ onStudy }: DailyBriefingPageProps): React.ReactElement {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await briefingApiClient.getDailyBriefing(selectedDate);
      setBriefing(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取简报失败';
      setError(msg);
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      await briefingApiClient.triggerBriefingGeneration();
      // 生成完成后重新加载
      await fetchBriefing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成简报失败';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [fetchBriefing]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const handleStudy = useCallback(
    (entry: NewsEntry) => {
      onStudy?.(entry);
    },
    [onStudy]
  );

  if (loading) return <Loading text="加载简报..." />;

  const grouped = briefing ? groupByDomain(briefing.entries) : new Map();

  return (
    <div className="daily-briefing">
      <div className="daily-briefing__header">
        <h1 className="daily-briefing__title">每日简报</h1>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {error && (
        <div className="daily-briefing__error">
          <p>{error}</p>
          <button className="daily-briefing__retry-btn" onClick={fetchBriefing}>
            重新加载
          </button>
        </div>
      )}

      {!error && (!briefing || briefing.entries.length === 0) && (
        <div className="daily-briefing__generating">
          <div className="daily-briefing__generating-icon">📰</div>
          <p className="daily-briefing__generating-text">
            {generating ? '正在从 RSS 源抓取新闻并翻译标题，请稍候...' : '今日简报尚未生成'}
          </p>
          {!generating && (
            <button className="daily-briefing__generate-btn" onClick={handleGenerate}>
              立即生成今日简报
            </button>
          )}
          {generating && (
            <div className="daily-briefing__generating-spinner" />
          )}
        </div>
      )}

      {briefing && briefing.entries.length > 0 && (
        <div className="daily-briefing__content">
          {DOMAIN_ORDER.map((domain) => {
            const entries = grouped.get(domain);
            if (!entries || entries.length === 0) return null;
            return (
              <DomainSection
                key={domain}
                label={BRIEFING_DOMAIN_LABELS[domain]}
                entries={entries}
                onStudy={handleStudy}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DailyBriefingPage;
