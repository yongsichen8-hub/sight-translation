/**
 * GlossaryManager 组件
 * 术语库管理视图，以表格形式显示术语
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button, Modal, Loading, Toast } from '../common';
import { expressionCollector } from '../../services/ExpressionCollector';
import { flashcardGenerator } from '../../services/FlashcardGenerator';
import { createTermExplainer, type TermExplanation } from '../../services/TermExplainer';
import { useAppActions } from '../../context/useAppActions';
import { API_PROVIDERS } from '../../types/models';
import type { Expression } from '../../types';
import './GlossaryManager.css';

export function GlossaryManager(): React.ReactElement {
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Expression | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ chinese: string; english: string; notes: string }>({ chinese: '', english: '', notes: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI 解释相关状态
  const [explainTarget, setExplainTarget] = useState<Expression | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<TermExplanation | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiConfig, setApiConfig] = useState(() => {
    const saved = localStorage.getItem('glossary_api_config');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return { provider: 'deepseek', apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' };
  });

  const { goToProjects, goToFlashcards } = useAppActions();

  const loadExpressions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await expressionCollector.getExpressions();
      setExpressions(data);
    } catch (err) {
      setError('加载术语库失败，请刷新页面重试');
      console.error('Failed to load expressions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpressions();
  }, [loadExpressions]);

  const filteredExpressions = useMemo(() => {
    if (!searchKeyword.trim()) return expressions;
    const keyword = searchKeyword.toLowerCase().trim();
    return expressions.filter(
      (expr) =>
        (expr.chinese || '').toLowerCase().includes(keyword) ||
        (expr.english || '').toLowerCase().includes(keyword) ||
        (expr.notes || '').toLowerCase().includes(keyword)
    );
  }, [expressions, searchKeyword]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  }, []);

  const handleStartEdit = useCallback((expr: Expression) => {
    setEditingId(expr.id);
    setEditValues({ 
      chinese: expr.chinese || '', 
      english: expr.english || '', 
      notes: expr.notes || '' 
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValues({ chinese: '', english: '', notes: '' });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    try {
      await expressionCollector.updateExpression(editingId, editValues);
      setExpressions((prev) =>
        prev.map((expr) =>
          expr.id === editingId
            ? { ...expr, ...editValues, updatedAt: new Date() }
            : expr
        )
      );
      setToast({ message: '术语已更新', type: 'success' });
      handleCancelEdit();
    } catch (err) {
      setToast({ message: '更新失败，请重试', type: 'error' });
    }
  }, [editingId, editValues, handleCancelEdit]);

  const handleDeleteClick = useCallback((expression: Expression) => {
    setDeleteTarget(expression);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await expressionCollector.deleteExpression(deleteTarget.id);
      setExpressions((prev) => prev.filter((expr) => expr.id !== deleteTarget.id));
      setToast({ message: '术语已删除', type: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      setToast({ message: '删除失败，请重试', type: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  const handleAddToFlashcard = useCallback(async (expr: Expression) => {
    try {
      await flashcardGenerator.scheduleExpression(expr.id);
      setToast({ message: '已添加到复习卡片', type: 'success' });
    } catch (err) {
      if (err instanceof Error && err.message.includes('already')) {
        setToast({ message: '该术语已在复习卡片中', type: 'error' });
      } else {
        setToast({ message: '添加失败，请重试', type: 'error' });
      }
    }
  }, []);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  // 导出为 Excel
  const handleExport = useCallback(() => {
    if (expressions.length === 0) {
      setToast({ message: '术语库为空，无法导出', type: 'error' });
      return;
    }

    const data = expressions.map((expr) => ({
      中文: expr.chinese || '',
      英文: expr.english || '',
      备注: expr.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '术语库');
    
    // 设置列宽
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 50 }];
    
    const fileName = `术语库_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setToast({ message: `已导出 ${expressions.length} 条术语`, type: 'success' });
  }, [expressions]);

  // 导入 Excel
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel 文件为空');
      }
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        throw new Error('无法读取工作表');
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        // 支持多种列名格式
        const chinese = row['中文'] || row['Chinese'] || row['chinese'] || '';
        const english = row['英文'] || row['English'] || row['english'] || '';
        const notes = row['备注'] || row['Notes'] || row['notes'] || '';

        if (!chinese && !english) {
          skipped++;
          continue;
        }

        try {
          await expressionCollector.importExpression({
            chinese: chinese.trim(),
            english: english.trim(),
            notes: notes.trim(),
          });
          imported++;
        } catch (err) {
          // 重复的术语跳过
          if (err instanceof Error && err.name === 'DuplicateError') {
            skipped++;
          } else {
            throw err;
          }
        }
      }

      await loadExpressions();
      setToast({ 
        message: `导入完成：${imported} 条成功${skipped > 0 ? `，${skipped} 条跳过` : ''}`, 
        type: 'success' 
      });
    } catch (err) {
      console.error('Import failed:', err);
      setToast({ message: '导入失败，请检查文件格式', type: 'error' });
    } finally {
      setImporting(false);
      // 清空 input 以便重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [loadExpressions]);

  // AI 解释功能
  const handleExplainClick = useCallback((expr: Expression) => {
    if (!apiConfig.apiKey) {
      setShowApiConfig(true);
      setToast({ message: '请先配置 API Key', type: 'error' });
      return;
    }
    setExplainTarget(expr);
    setExplanation(null);
    setExplaining(true);

    const explainer = createTermExplainer({
      apiKey: apiConfig.apiKey,
      baseUrl: apiConfig.baseUrl,
      model: apiConfig.model,
    });

    explainer.explain(expr.chinese || '', expr.english || '')
      .then((result) => {
        setExplanation(result);
      })
      .catch((err) => {
        console.error('AI explain failed:', err);
        setToast({ message: 'AI 解释失败：' + (err instanceof Error ? err.message : '未知错误'), type: 'error' });
        setExplainTarget(null);
      })
      .finally(() => {
        setExplaining(false);
      });
  }, [apiConfig]);

  const handleCloseExplanation = useCallback(() => {
    setExplainTarget(null);
    setExplanation(null);
  }, []);

  const handleSaveApiConfig = useCallback(() => {
    localStorage.setItem('glossary_api_config', JSON.stringify(apiConfig));
    setShowApiConfig(false);
    setToast({ message: 'API 配置已保存', type: 'success' });
  }, [apiConfig]);

  const handleProviderChange = useCallback((provider: string) => {
    const providerKey = provider as keyof typeof API_PROVIDERS;
    const preset = API_PROVIDERS[providerKey];
    if (preset) {
      setApiConfig((prev: typeof apiConfig) => ({
        ...prev,
        provider,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
      }));
    }
  }, []);

  if (loading) {
    return <Loading text="加载术语库..." />;
  }

  if (error) {
    return (
      <div className="glossary-manager">
        <div className="glossary-manager__empty">
          <div className="glossary-manager__empty-icon">⚠️</div>
          <p className="glossary-manager__empty-text">{error}</p>
          <Button onClick={loadExpressions}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glossary-manager">
      <div className="glossary-manager__header">
        <h1 className="glossary-manager__title">术语库</h1>
        <div className="glossary-manager__nav">
          <Button variant="ghost" onClick={() => setShowApiConfig(true)}>
            API 配置
          </Button>
          <Button variant="ghost" onClick={handleExport} disabled={expressions.length === 0}>
            导出 Excel
          </Button>
          <Button variant="ghost" onClick={handleImportClick} disabled={importing}>
            {importing ? '导入中...' : '导入 Excel'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button variant="ghost" onClick={goToFlashcards}>Flashcard 复习</Button>
          <Button variant="secondary" onClick={goToProjects}>返回项目</Button>
        </div>
      </div>

      {expressions.length === 0 ? (
        <div className="glossary-manager__empty">
          <div className="glossary-manager__empty-icon">📚</div>
          <p className="glossary-manager__empty-text">
            术语库为空，在练习时选择文本并保存术语来构建你的术语库
          </p>
          <Button onClick={goToProjects}>开始练习</Button>
        </div>
      ) : (
        <>
          <div className="glossary-manager__filters">
            <input
              type="text"
              className="glossary-manager__search-input"
              placeholder="搜索术语..."
              value={searchKeyword}
              onChange={handleSearchChange}
            />
            <div className="glossary-manager__stats">
              共 {filteredExpressions.length} 条术语
              {filteredExpressions.length !== expressions.length && ` / 总计 ${expressions.length} 条`}
            </div>
          </div>

          {filteredExpressions.length === 0 ? (
            <div className="glossary-manager__empty">
              <div className="glossary-manager__empty-icon">🔍</div>
              <p className="glossary-manager__empty-text">没有找到匹配的术语</p>
            </div>
          ) : (
            <div className="glossary-manager__table-wrapper">
              <table className="glossary-manager__table">
                <thead>
                  <tr>
                    <th>中文</th>
                    <th>英文</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpressions.map((expr) => (
                    <tr key={expr.id}>
                      {editingId === expr.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              className="glossary-manager__edit-input"
                              value={editValues.chinese}
                              onChange={(e) => setEditValues((v) => ({ ...v, chinese: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="glossary-manager__edit-input"
                              value={editValues.english}
                              onChange={(e) => setEditValues((v) => ({ ...v, english: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="glossary-manager__edit-input"
                              value={editValues.notes}
                              onChange={(e) => setEditValues((v) => ({ ...v, notes: e.target.value }))}
                            />
                          </td>
                          <td className="glossary-manager__actions">
                            <button className="glossary-manager__btn glossary-manager__btn--save" onClick={handleSaveEdit}>保存</button>
                            <button className="glossary-manager__btn glossary-manager__btn--cancel" onClick={handleCancelEdit}>取消</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{expr.chinese || ''}</td>
                          <td>{expr.english || ''}</td>
                          <td className="glossary-manager__notes">{expr.notes || '-'}</td>
                          <td className="glossary-manager__actions">
                            <button className="glossary-manager__btn glossary-manager__btn--ai" onClick={() => handleExplainClick(expr)}>AI解释</button>
                            <button className="glossary-manager__btn" onClick={() => handleStartEdit(expr)}>编辑</button>
                            <button className="glossary-manager__btn" onClick={() => handleAddToFlashcard(expr)}>+卡片</button>
                            <button className="glossary-manager__btn glossary-manager__btn--danger" onClick={() => handleDeleteClick(expr)}>删除</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        visible={deleteTarget !== null}
        title="确认删除"
        onClose={handleDeleteCancel}
        footer={
          <div className="delete-confirm__actions">
            <Button variant="secondary" onClick={handleDeleteCancel} disabled={deleting}>取消</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>确认删除</Button>
          </div>
        }
      >
        <div className="delete-confirm__message">
          确定要删除术语 <strong>"{deleteTarget?.chinese}"</strong> 吗？
          <p className="delete-confirm__warning">此操作不可撤销，关联的复习卡片也将被删除。</p>
        </div>
      </Modal>

      {/* AI 解释弹窗 */}
      <Modal
        visible={explainTarget !== null}
        title={`AI 解释：${explainTarget?.chinese || ''} / ${explainTarget?.english || ''}`}
        onClose={handleCloseExplanation}
      >
        <div className="glossary-manager__explanation">
          {explaining ? (
            <div className="glossary-manager__explanation-loading">
              <div className="glossary-manager__spinner" />
              <p>正在生成解释...</p>
            </div>
          ) : explanation ? (
            <>
              <div className="glossary-manager__explanation-section">
                <h4>中文解释</h4>
                <p>{explanation.chineseExplanation}</p>
              </div>
              <div className="glossary-manager__explanation-section">
                <h4>English Explanation</h4>
                <p>{explanation.englishExplanation}</p>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* API 配置弹窗 */}
      <Modal
        visible={showApiConfig}
        title="API 配置"
        onClose={() => setShowApiConfig(false)}
        footer={
          <div className="delete-confirm__actions">
            <Button variant="secondary" onClick={() => setShowApiConfig(false)}>取消</Button>
            <Button onClick={handleSaveApiConfig}>保存</Button>
          </div>
        }
      >
        <div className="glossary-manager__api-config">
          <div className="glossary-manager__config-field">
            <label>API 提供商</label>
            <select
              value={apiConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {Object.entries(API_PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="glossary-manager__config-field">
            <label>API Key</label>
            <input
              type="password"
              value={apiConfig.apiKey}
              onChange={(e) => setApiConfig((prev: typeof apiConfig) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="输入 API Key"
            />
          </div>
          <div className="glossary-manager__config-field">
            <label>Base URL</label>
            <input
              type="text"
              value={apiConfig.baseUrl}
              onChange={(e) => setApiConfig((prev: typeof apiConfig) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="API Base URL"
            />
          </div>
          <div className="glossary-manager__config-field">
            <label>模型</label>
            <input
              type="text"
              value={apiConfig.model}
              onChange={(e) => setApiConfig((prev: typeof apiConfig) => ({ ...prev, model: e.target.value }))}
              placeholder="模型名称"
            />
          </div>
        </div>
      </Modal>

      {toast && <Toast visible={true} message={toast.message} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
}

export default GlossaryManager;
