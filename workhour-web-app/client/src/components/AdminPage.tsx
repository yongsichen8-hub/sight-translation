import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllTimeRecords, updateTimeRecord, TimeRecord } from '../services/api';
import './AdminPage.css';

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<number | null>(null);

  // Filters
  const [translatorFilter, setTranslatorFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edited values: recordId -> input string (keep as string during editing)
  const [edits, setEdits] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: { startDate?: string; endDate?: string } = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const data = await getAllTimeRecords(filters);
      setRecords(data);
      setEdits({});
    } catch {
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!isAdmin) {
    return <div className="admin-page"><div className="admin-error">无权限访问此页面</div></div>;
  }

  // Client-side filtering
  const filtered = records.filter(r => {
    if (translatorFilter && !r.translatorName.includes(translatorFilter)) return false;
    if (projectFilter && !r.projectName.includes(projectFilter)) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  });

  const handleEdit = (id: number, value: string) => {
    setEdits(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async (record: TimeRecord) => {
    const raw = edits[record.id];
    if (raw === undefined) return;
    const newTime = parseFloat(raw);
    if (isNaN(newTime) || newTime < 0) {
      alert('工时不能为负数');
      return;
    }
    if (newTime === record.time) return;
    setSaving(record.id);
    try {
      const result = await updateTimeRecord(record.id, newTime);
      // Update local state
      setRecords(prev => prev.map(r => r.id === record.id ? result.record : r));
      setEdits(prev => { const next = { ...prev }; delete next[record.id]; return next; });
      if (result.syncStatus === 'partial') {
        alert('工时已保存，但飞书同步失败');
      }
    } catch {
      alert('保存失败，请重试');
    } finally {
      setSaving(null);
    }
  };

  const isEdited = (id: number) => {
    const raw = edits[id];
    if (raw === undefined) return false;
    const num = parseFloat(raw);
    return !isNaN(num) && num >= 0;
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return (
    <div className="admin-error">
      {error}
      <button onClick={loadData} className="admin-retry-btn">重试</button>
    </div>
  );

  return (
    <div className="admin-page">
      <h2 className="admin-title">工时管理</h2>

      <div className="admin-filters">
        <input placeholder="译员姓名" value={translatorFilter} onChange={e => setTranslatorFilter(e.target.value)} className="admin-input" />
        <input placeholder="项目名称" value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="admin-input" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="admin-select">
          <option value="">全部类型</option>
          <option value="interpretation">口译</option>
          <option value="translation">笔译</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="admin-input" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="admin-input" />
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>译员</th>
            <th>项目名称</th>
            <th>类型</th>
            <th>日期</th>
            <th>工时（分钟）</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={6} className="admin-empty">暂无数据</td></tr>
          ) : filtered.map(r => (
            <tr key={r.id}>
              <td>{r.translatorName}</td>
              <td>{r.projectName}</td>
              <td>{r.type === 'interpretation' ? '口译' : '笔译'}</td>
              <td>{new Date(r.date).toLocaleDateString('zh-CN')}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="admin-time-input"
                  value={edits[r.id] !== undefined ? edits[r.id] : String(r.time)}
                  onChange={e => handleEdit(r.id, e.target.value)}
                />
              </td>
              <td>
                <button
                  className="admin-save-btn"
                  disabled={!isEdited(r.id) || saving === r.id}
                  onClick={() => handleSave(r)}
                >
                  {saving === r.id ? '保存中...' : '保存'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
