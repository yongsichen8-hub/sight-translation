import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/api/client';
import type {
  InspirationEntry,
  InspirationCategory,
  CreateInspirationDTO,
  UpdateInspirationDTO,
} from '@/types';

/* ── CategoryFilter ── */

interface CategoryFilterProps {
  categories: InspirationCategory[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

function CategoryFilter({ categories, selectedId, onSelect }: CategoryFilterProps) {
  return (
    <div className="category-filter">
      <button
        className={`category-filter__btn${selectedId === null ? ' category-filter__btn--active' : ''}`}
        onClick={() => onSelect(null)}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`category-filter__btn${selectedId === cat.id ? ' category-filter__btn--active' : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

/* ── InspirationForm ── */

interface InspirationFormProps {
  categories: InspirationCategory[];
  onSubmit: (data: CreateInspirationDTO) => void;
}

function InspirationForm({ categories, onSubmit }: InspirationFormProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'inspiration' | 'todo'>('inspiration');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (categories.length > 0 && !categories.find((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }
    setError('');
    onSubmit({ content: content.trim(), type, categoryId });
    setContent('');
  };

  return (
    <form className="inspiration-form" onSubmit={handleSubmit}>
      <div className="inspiration-form__row">
        <textarea
          className="textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录一个灵感或待办..."
          rows={2}
        />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="inspiration-form__actions">
        <select
          className="select select-sm"
          value={type}
          onChange={(e) => setType(e.target.value as 'inspiration' | 'todo')}
          aria-label="类型"
        >
          <option value="inspiration">💡 灵感</option>
          <option value="todo">✅ 待办</option>
        </select>
        <select
          className="select select-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          aria-label="灵感分类"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-sm">
          添加
        </button>
      </div>
    </form>
  );
}


/* ── InspirationItem ── */

interface InspirationItemProps {
  entry: InspirationEntry;
  categoryName: string;
  onToggleComplete: (id: number, completed: boolean) => void;
  onEdit: (entry: InspirationEntry) => void;
  onDelete: (id: number) => void;
}

function InspirationItem({ entry, categoryName, onToggleComplete, onEdit, onDelete }: InspirationItemProps) {
  const isTodo = entry.type === 'todo';
  const typeIcon = isTodo ? '✅' : '💡';

  return (
    <div className={`inspiration-item${entry.completed ? ' inspiration-item--completed' : ''}`}>
      {isTodo && (
        <label className="inspiration-item__check">
          <input
            type="checkbox"
            checked={entry.completed}
            onChange={() => onToggleComplete(entry.id, !entry.completed)}
            aria-label={`完成状态: ${entry.content}`}
          />
        </label>
      )}
      <span className="inspiration-item__type" title={isTodo ? '待办' : '灵感'}>
        {typeIcon}
      </span>
      <span className={`inspiration-item__content${entry.completed ? ' line-through opacity-50' : ''}`}>
        {entry.content}
      </span>
      <span className="inspiration-item__category badge badge--info">{categoryName}</span>
      <div className="inspiration-item__actions">
        <button className="btn-icon btn-sm" onClick={() => onEdit(entry)} aria-label="编辑" title="编辑">
          ✏️
        </button>
        <button className="btn-icon btn-sm" onClick={() => onDelete(entry.id)} aria-label="删除" title="删除">
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ── InspirationList ── */

interface InspirationListProps {
  entries: InspirationEntry[];
  categoryMap: Map<number, InspirationCategory>;
  onToggleComplete: (id: number, completed: boolean) => void;
  onEdit: (entry: InspirationEntry) => void;
  onDelete: (id: number) => void;
}

function InspirationList({ entries, categoryMap, onToggleComplete, onEdit, onDelete }: InspirationListProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💡</div>
        <p>暂无灵感记录，快来添加一条吧</p>
      </div>
    );
  }

  return (
    <div className="inspiration-list">
      {entries.map((entry) => (
        <InspirationItem
          key={entry.id}
          entry={entry}
          categoryName={categoryMap.get(entry.categoryId)?.name ?? '未知'}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}


/* ── Edit Entry Modal ── */

interface EditEntryModalProps {
  entry: InspirationEntry;
  categories: InspirationCategory[];
  onSubmit: (id: number, data: UpdateInspirationDTO) => void;
  onCancel: () => void;
}

function EditEntryModal({ entry, categories, onSubmit, onCancel }: EditEntryModalProps) {
  const [content, setContent] = useState(entry.content);
  const [type, setType] = useState(entry.type);
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }
    onSubmit(entry.id, { content: content.trim(), type, categoryId });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>编辑条目</h3>
          <button className="btn-icon" onClick={onCancel} aria-label="关闭">✕</button>
        </div>
        <form className="modal-body okr-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">内容</label>
            <textarea
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入内容"
            />
          </div>
          <div className="form-group">
            <label className="form-label">类型</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as 'inspiration' | 'todo')}>
              <option value="inspiration">💡 灵感</option>
              <option value="todo">✅ 待办</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">分类</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">保存修改</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>确认操作</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}


/* ── Category Management Section ── */

interface CategoryManagementProps {
  categories: InspirationCategory[];
  onAdd: (name: string) => void;
  onEdit: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}

function CategoryManagement({ categories, onAdd, onEdit, onDelete }: CategoryManagementProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) {
      setError('请输入分类名称');
      return;
    }
    setError('');
    onAdd(newName.trim());
    setNewName('');
  };

  const handleStartEdit = (cat: InspirationCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = () => {
    if (!editingName.trim()) return;
    if (editingId !== null) {
      onEdit(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="inspiration-categories">
      <h3>📂 灵感分类管理</h3>
      <div className="inspiration-categories__add">
        <input
          className="input input-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新分类名称"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          新增分类
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="inspiration-categories__list">
        {categories.map((cat) => (
          <div key={cat.id} className="inspiration-categories__item">
            {editingId === cat.id ? (
              <>
                <input
                  className="input input-sm"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  autoFocus
                />
                <button className="btn btn-success btn-sm" onClick={handleSaveEdit}>保存</button>
                <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>取消</button>
              </>
            ) : (
              <>
                <span className="inspiration-categories__name">{cat.name}</span>
                <div className="inspiration-categories__actions">
                  <button className="btn-icon btn-sm" onClick={() => handleStartEdit(cat)} aria-label={`编辑分类 ${cat.name}`} title="编辑">
                    ✏️
                  </button>
                  <button className="btn-icon btn-sm" onClick={() => onDelete(cat.id)} aria-label={`删除分类 ${cat.name}`} title="删除">
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ── Modal state types ── */

type ModalState =
  | { type: 'none' }
  | { type: 'editEntry'; entry: InspirationEntry }
  | { type: 'deleteEntry'; entryId: number }
  | { type: 'deleteCategory'; categoryId: number };

/* ── Main InspirationPage ── */

function InspirationPage() {
  const [categories, setCategories] = useState<InspirationCategory[]>([]);
  const [entries, setEntries] = useState<InspirationEntry[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const categoryMap = useMemo(() => {
    const map = new Map<number, InspirationCategory>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  // Sort entries by createdAt descending
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries],
  );

  const fetchData = useCallback(async (categoryId: number | null) => {
    setLoading(true);
    setError('');
    try {
      const [cats, items] = await Promise.all([
        apiClient.inspirationCategories.list(),
        apiClient.inspirations.list(categoryId ?? undefined),
      ]);
      setCategories(cats);
      setEntries(items);
    } catch {
      setError('加载灵感数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedCategoryId);
  }, [selectedCategoryId, fetchData]);

  const handleFilterChange = (id: number | null) => {
    setSelectedCategoryId(id);
  };

  /* ── Entry CRUD ── */

  const handleCreateEntry = async (data: CreateInspirationDTO) => {
    try {
      await apiClient.inspirations.create(data);
      fetchData(selectedCategoryId);
    } catch {
      setError('添加灵感失败');
    }
  };

  const handleUpdateEntry = async (id: number, data: UpdateInspirationDTO) => {
    try {
      await apiClient.inspirations.update(id, data);
      setModal({ type: 'none' });
      fetchData(selectedCategoryId);
    } catch {
      setError('更新灵感失败');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      await apiClient.inspirations.delete(id);
      setModal({ type: 'none' });
      fetchData(selectedCategoryId);
    } catch {
      setError('删除灵感失败');
    }
  };

  const handleToggleComplete = async (id: number, completed: boolean) => {
    try {
      await apiClient.inspirations.update(id, { completed });
      fetchData(selectedCategoryId);
    } catch {
      setError('更新完成状态失败');
    }
  };

  /* ── Category CRUD ── */

  const handleAddCategory = async (name: string) => {
    try {
      await apiClient.inspirationCategories.create(name);
      fetchData(selectedCategoryId);
    } catch {
      setError('新增分类失败');
    }
  };

  const handleEditCategory = async (id: number, name: string) => {
    try {
      await apiClient.inspirationCategories.update(id, name);
      fetchData(selectedCategoryId);
    } catch {
      setError('编辑分类失败');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await apiClient.inspirationCategories.delete(id);
      setModal({ type: 'none' });
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
      fetchData(selectedCategoryId === id ? null : selectedCategoryId);
    } catch {
      setError('删除分类失败');
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <div className="inspiration-page">
        <div className="loading-overlay">
          <div className="loading-spinner loading-spinner--lg" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="inspiration-page">
      <h2>💡 灵感与待办</h2>

      {error && <div className="auth-error mt-md">{error}</div>}

      <InspirationForm categories={categories} onSubmit={handleCreateEntry} />

      <CategoryFilter
        categories={categories}
        selectedId={selectedCategoryId}
        onSelect={handleFilterChange}
      />

      <InspirationList
        entries={sortedEntries}
        categoryMap={categoryMap}
        onToggleComplete={handleToggleComplete}
        onEdit={(entry) => setModal({ type: 'editEntry', entry })}
        onDelete={(id) => setModal({ type: 'deleteEntry', entryId: id })}
      />

      <div className="divider" />

      <CategoryManagement
        categories={categories}
        onAdd={handleAddCategory}
        onEdit={handleEditCategory}
        onDelete={(id) => setModal({ type: 'deleteCategory', categoryId: id })}
      />

      {/* ── Modals ── */}

      {modal.type === 'editEntry' && (
        <EditEntryModal
          entry={modal.entry}
          categories={categories}
          onSubmit={handleUpdateEntry}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'deleteEntry' && (
        <ConfirmDialog
          message="确定要删除此条目吗？"
          onConfirm={() => handleDeleteEntry(modal.entryId)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'deleteCategory' && (
        <ConfirmDialog
          message="确定要删除此灵感分类吗？"
          onConfirm={() => handleDeleteCategory(modal.categoryId)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  );
}

export default InspirationPage;
