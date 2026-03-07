/**
 * TermLibraryPage 组件
 * 术语库容器：管理术语列表状态、筛选条件和选中术语详情
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loading } from '../common';
import { Toast } from '../common/Toast/Toast';
import type { Term, TermFilters as TermFiltersType } from '../../types/briefing';
import { briefingApiClient } from '../../services/BriefingApiClient';
import { TermFilters } from './TermFilters';
import { TermList } from './TermList';
import { TermDetail } from './TermDetail';
import './TermLibrary.css';

export function TermLibraryPage(): React.ReactElement {
  const [terms, setTerms] = useState<Term[]>([]);
  const [filters, setFilters] = useState<TermFiltersType>({});
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await briefingApiClient.getTerms(filters);
      setTerms(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取术语失败';
      setError(msg);
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleFilterChange = useCallback((newFilters: TermFiltersType) => {
    setFilters(newFilters);
    setSelectedTermId(null);
  }, []);

  const handleSelectTerm = useCallback((termId: string) => {
    setSelectedTermId((prev) => (prev === termId ? null : termId));
  }, []);

  const handleUpdateTerm = useCallback(
    async (id: string, updates: { chinese?: string; context?: string }) => {
      try {
        await briefingApiClient.updateTerm(id, updates);
        setTerms((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
        );
        setToast({ message: '术语已更新', type: 'success' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '更新失败';
        setToast({ message: msg, type: 'error' });
        throw err;
      }
    },
    []
  );

  const handleDeleteTerm = useCallback(
    async (id: string) => {
      try {
        await briefingApiClient.deleteTerm(id);
        setTerms((prev) => prev.filter((t) => t.id !== id));
        setSelectedTermId(null);
        setToast({ message: '术语已删除', type: 'success' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '删除失败';
        setToast({ message: msg, type: 'error' });
        throw err;
      }
    },
    []
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedTermId(null);
  }, []);

  const selectedTerm = terms.find((t) => t.id === selectedTermId) || null;

  if (loading) return <Loading text="加载术语库..." />;

  return (
    <div className="term-library">
      <div className="term-library__header">
        <h1 className="term-library__title">术语库</h1>
        <span className="term-library__count">{terms.length} 个术语</span>
      </div>

      <TermFilters filters={filters} onFilterChange={handleFilterChange} />

      {error && (
        <div className="term-library__error">
          <p>{error}</p>
          <button className="term-library__retry-btn" onClick={fetchTerms} type="button">
            重新加载
          </button>
        </div>
      )}

      {!error && (
        <div className="term-library__body">
          <div className="term-library__list-panel">
            <TermList
              terms={terms}
              selectedTermId={selectedTermId}
              onSelectTerm={handleSelectTerm}
            />
          </div>

          {selectedTerm && (
            <div className="term-library__detail-panel">
              <TermDetail
                term={selectedTerm}
                onUpdate={handleUpdateTerm}
                onDelete={handleDeleteTerm}
                onClose={handleCloseDetail}
              />
            </div>
          )}
        </div>
      )}

      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'success'}
        visible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default TermLibraryPage;
