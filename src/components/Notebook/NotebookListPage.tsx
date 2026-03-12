/**
 * NotebookListPage 组件
 * 笔记本项目列表页面，支持创建、编辑、删除和导航到工作区
 */

import { useState, useEffect, useCallback, useId } from 'react';
import { Button, Modal, Loading, Toast } from '../common';
import { apiClient } from '../../services/ApiClient';
import type { NotebookProject, NotebookProjectInput } from '../../services/ApiClient';
import { useAppActions } from '../../context/useAppActions';
import './NotebookListPage.css';

export function NotebookListPage() {
  const [notebooks, setNotebooks] = useState<NotebookProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<NotebookProject | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotebookProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { goToNotebookWorkspace } = useAppActions();
  const titleInputId = useId();

  const loadNotebooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getNotebooks();
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotebooks(data);
    } catch {
      setError('加载笔记本列表失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotebooks(); }, [loadNotebooks]);

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDomain('');
    setFormStartDate('');
    setFormEndDate('');
    setFormError('');
    setEditTarget(null);
  }, []);

  const openCreateForm = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const openEditForm = useCallback((nb: NotebookProject) => {
    setEditTarget(nb);
    setFormTitle(nb.title);
    setFormDomain(nb.domain);
    setFormStartDate(nb.startDate || '');
    setFormEndDate(nb.endDate || '');
    setFormError('');
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, [resetForm]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('标题不能为空');
      return;
    }
    try {
      setSubmitting(true);
      const input: NotebookProjectInput = { title: formTitle.trim() };
      if (formDomain.trim()) input.domain = formDomain.trim();
      if (formStartDate) input.startDate = formStartDate;
      if (formEndDate) input.endDate = formEndDate;
      if (editTarget) {
        await apiClient.updateNotebook(editTarget.id, input);
        setToast({ message: '项目已更新', type: 'success' });
      } else {
        await apiClient.createNotebook(input);
        setToast({ message: '项目已创建', type: 'success' });
      }
      closeForm();
      await loadNotebooks();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [formTitle, formDomain, formStartDate, formEndDate, editTarget, closeForm, loadNotebooks]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.deleteNotebook(deleteTarget.id);
      setNotebooks(prev => prev.filter(n => n.id !== deleteTarget.id));
      setToast({ message: `项目 "${deleteTarget.title}" 已删除`, type: 'success' });
      setDeleteTarget(null);
    } catch {
      setToast({ message: '删除项目失败，请重试', type: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) return <Loading text="加载笔记本列表..." />;

  if (error) {
    return (
      <div className="notebook-list">
        <div className="notebook-list__empty">
          <div className="notebook-list__empty-icon">⚠️</div>
          <p className="notebook-list__empty-text">{error}</p>
          <Button onClick={loadNotebooks}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="notebook-list">
      <div className="notebook-list__header">
        <h1 className="notebook-list__title">笔记本</h1>
        <Button onClick={openCreateForm}>新建项目</Button>
      </div>

      {notebooks.length === 0 ? (
        <div className="notebook-list__empty">
          <div className="notebook-list__empty-icon">📓</div>
          <p className="notebook-list__empty-text">还没有任何笔记本项目，点击上方按钮创建第一个项目</p>
          <Button onClick={openCreateForm}>新建项目</Button>
        </div>
      ) : (
        <div className="notebook-list__items">
          {notebooks.map(nb => (
            <div
              key={nb.id}
              className="notebook-card"
              onClick={() => goToNotebookWorkspace(nb.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') goToNotebookWorkspace(nb.id); }}
            >
              <div className="notebook-card__header">
                <h2 className="notebook-card__name">{nb.title}</h2>
                <div className="notebook-card__actions" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => openEditForm(nb)}
                    aria-label={`编辑项目 ${nb.title}`}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => setDeleteTarget(nb)}
                    aria-label={`删除项目 ${nb.title}`}
                  >
                    删除
                  </Button>
                </div>
              </div>
              <div className="notebook-card__info">
                {nb.domain && (
                  <span className="notebook-card__domain">
                    <span className="notebook-card__domain-icon">🏷️</span>
                    {nb.domain}
                  </span>
                )}
                <span className="notebook-card__date">创建于 {formatDate(nb.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑表单 Modal */}
      <Modal
        visible={showForm}
        title={editTarget ? '编辑项目' : '新建项目'}
        onClose={closeForm}
        footer={
          <div className="notebook-form__actions">
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>取消</Button>
            <Button onClick={() => handleFormSubmit({ preventDefault: () => {} } as React.FormEvent)} loading={submitting}>
              {editTarget ? '保存' : '创建'}
            </Button>
          </div>
        }
      >
        <form className="notebook-form" onSubmit={handleFormSubmit}>
          <div className="notebook-form__field">
            <label className="notebook-form__label" htmlFor={titleInputId}>
              标题<span className="notebook-form__required">*</span>
            </label>
            <input
              id={titleInputId}
              type="text"
              className={`notebook-form__input ${formError && !formTitle.trim() ? 'notebook-form__input--error' : ''}`}
              value={formTitle}
              onChange={e => { setFormTitle(e.target.value); if (formError) setFormError(''); }}
              placeholder="请输入项目标题"
              disabled={submitting}
            />
            {formError && <div className="notebook-form__error" role="alert">⚠️ {formError}</div>}
          </div>
          <div className="notebook-form__field">
            <label className="notebook-form__label">领域</label>
            <input
              type="text"
              className="notebook-form__input"
              value={formDomain}
              onChange={e => setFormDomain(e.target.value)}
              placeholder="如：金融、法律、医学"
              disabled={submitting}
            />
          </div>
          <div className="notebook-form__row">
            <div className="notebook-form__field">
              <label className="notebook-form__label">开始日期</label>
              <input
                type="date"
                className="notebook-form__input"
                value={formStartDate}
                onChange={e => setFormStartDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="notebook-form__field">
              <label className="notebook-form__label">结束日期</label>
              <input
                type="date"
                className="notebook-form__input"
                value={formEndDate}
                onChange={e => setFormEndDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        visible={deleteTarget !== null}
        title="确认删除"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="notebook-form__actions">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>确认删除</Button>
          </div>
        }
      >
        <div className="notebook-delete__message">
          确定要删除项目{' '}
          <span className="notebook-delete__name">"{deleteTarget?.title}"</span>{' '}
          吗？
          <p className="notebook-delete__warning">此操作不可撤销，项目关联的所有备忘录和整理结果也将被删除。</p>
        </div>
      </Modal>

      {toast && (
        <Toast visible message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default NotebookListPage;
