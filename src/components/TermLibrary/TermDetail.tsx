/**
 * TermDetail 组件
 * 术语详情面板：展示完整信息，支持内联编辑和删除
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { Term } from '../../types/briefing';
import { BRIEFING_DOMAIN_LABELS } from '../../types/briefing';

interface TermDetailProps {
  term: Term;
  onUpdate: (id: string, updates: { chinese?: string; context?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TermDetail({ term, onUpdate, onDelete, onClose }: TermDetailProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [chinese, setChinese] = useState(term.chinese);
  const [context, setContext] = useState(term.context);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset state when term changes
  useEffect(() => {
    setChinese(term.chinese);
    setContext(term.context);
    setEditing(false);
    setConfirmDelete(false);
  }, [term.id, term.chinese, term.context]);

  const handleEdit = useCallback(() => {
    setEditing(true);
    setConfirmDelete(false);
  }, []);

  const handleCancel = useCallback(() => {
    setChinese(term.chinese);
    setContext(term.context);
    setEditing(false);
  }, [term.chinese, term.context]);

  const handleSave = useCallback(async () => {
    if (!chinese.trim()) return;
    setSaving(true);
    try {
      await onUpdate(term.id, { chinese: chinese.trim(), context: context.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [term.id, chinese, context, onUpdate]);

  const handleDeleteClick = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setSaving(true);
    try {
      await onDelete(term.id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }, [term.id, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  return (
    <div className="term-detail">
      <div className="term-detail__header">
        <h3 className="term-detail__title">术语详情</h3>
        <button
          className="term-detail__close-btn"
          onClick={onClose}
          aria-label="关闭详情"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="term-detail__body">
        <div className="term-detail__field">
          <span className="term-detail__label">英文术语</span>
          <span className="term-detail__value term-detail__value--english">{term.english}</span>
        </div>

        <div className="term-detail__field">
          <span className="term-detail__label">中文释义</span>
          {editing ? (
            <input
              className="term-detail__input"
              type="text"
              value={chinese}
              onChange={(e) => setChinese(e.target.value)}
              aria-label="编辑中文释义"
            />
          ) : (
            <span className="term-detail__value">{term.chinese}</span>
          )}
        </div>

        <div className="term-detail__field">
          <span className="term-detail__label">语境原句</span>
          {editing ? (
            <textarea
              className="term-detail__textarea"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              aria-label="编辑语境原句"
            />
          ) : (
            <span className="term-detail__value term-detail__value--context">
              {term.context || '—'}
            </span>
          )}
        </div>

        <div className="term-detail__field">
          <span className="term-detail__label">所属领域</span>
          <span className="term-detail__value">{BRIEFING_DOMAIN_LABELS[term.domain]}</span>
        </div>

        <div className="term-detail__field">
          <span className="term-detail__label">出处文章</span>
          <span className="term-detail__value">{term.sourceArticleTitle || '—'}</span>
        </div>

        <div className="term-detail__field">
          <span className="term-detail__label">收藏时间</span>
          <span className="term-detail__value">{new Date(term.createdAt).toLocaleString('zh-CN')}</span>
        </div>
      </div>

      <div className="term-detail__actions">
        {editing ? (
          <>
            <button
              className="term-detail__btn term-detail__btn--cancel"
              onClick={handleCancel}
              disabled={saving}
              type="button"
            >
              取消
            </button>
            <button
              className="term-detail__btn term-detail__btn--save"
              onClick={handleSave}
              disabled={saving || !chinese.trim()}
              type="button"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        ) : confirmDelete ? (
          <>
            <span className="term-detail__confirm-text">确认删除此术语？</span>
            <button
              className="term-detail__btn term-detail__btn--cancel"
              onClick={handleDeleteCancel}
              disabled={saving}
              type="button"
            >
              取消
            </button>
            <button
              className="term-detail__btn term-detail__btn--delete"
              onClick={handleDeleteConfirm}
              disabled={saving}
              type="button"
            >
              {saving ? '删除中...' : '确认删除'}
            </button>
          </>
        ) : (
          <>
            <button
              className="term-detail__btn term-detail__btn--edit"
              onClick={handleEdit}
              type="button"
            >
              编辑
            </button>
            <button
              className="term-detail__btn term-detail__btn--delete"
              onClick={handleDeleteClick}
              type="button"
            >
              删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TermDetail;
