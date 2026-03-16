/**
 * TermLibraryPage 组件
 * 术语库容器：管理术语列表状态、筛选条件、选中术语详情和批量操作
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

  // 批量选择状态
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

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

  // 退出选择模式时清空选中
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setCheckedIds(new Set());
      return !prev;
    });
  }, []);

  const handleCheckChange = useCallback((termId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(termId);
      else next.delete(termId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (checkedIds.size === terms.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(terms.map((t) => t.id)));
    }
  }, [terms, checkedIds.size]);

  const handleBatchDelete = useCallback(async () => {
    if (checkedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      await briefingApiClient.deleteTermsBatch(Array.from(checkedIds));
      setTerms((prev) => prev.filter((t) => !checkedIds.has(t.id)));
      if (selectedTermId && checkedIds.has(selectedTermId)) {
        setSelectedTermId(null);
      }
      setToast({ message: `已删除 ${checkedIds.size} 个术语`, type: 'success' });
      setCheckedIds(new Set());
      setSelectionMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '批量删除失败';
      setToast({ message: msg, type: 'error' });
    } finally {
      setBatchDeleting(false);
    }
  }, [checkedIds, selectedTermId]);

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
  const allChecked = terms.length > 0 && checkedIds.size === terms.length;

  if (loading) return <Loading text="加载术语库..." />;

  return (
    <div className="term-library">
      <div className="term-library__header">
        <h1 className="term-library__title">术语库</h1>
        <div className="term-library__header-right">
          <span className="term-library__count">{terms.length} 个术语</span>
          {terms.length > 0 && (
            <button
              className={`term-library__manage-btn ${selectionMode ? 'term-library__manage-btn--active' : ''}`}
              onClick={toggleSelectionMode}
              type="button"
            >
              {selectionMode ? '取消' : '管理'}
            </button>
          )}
        </div>
      </div>

      <TermFilters filters={filters} onFilterChange={handleFilterChange} />

      {selectionMode && terms.length > 0 && (
        <div className="term-library__batch-bar">
          <label className="term-library__select-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={handleSelectAll}
            />
            <span>全选</span>
          </label>
          <span className="term-library__batch-info">
            已选 {checkedIds.size} / {terms.length}
          </span>
          <button
            className="term-library__batch-delete-btn"
            onClick={handleBatchDelete}
            disabled={checkedIds.size === 0 || batchDeleting}
            type="button"
          >
            {batchDeleting ? '删除中...' : `删除 (${checkedIds.size})`}
          </button>
        </div>
      )}

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
              selectionMode={selectionMode}
              checkedIds={checkedIds}
              onCheckChange={handleCheckChange}
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
