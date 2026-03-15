/**
 * NotebookWorkspace 组件
 * 笔记本工作区主页面，三栏布局：左侧备忘录编辑器、中间操作按钮、右侧整理结果
 */

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { apiClient } from '../../services/ApiClient';
import type { NotebookProject, MemoContent, OrganizedResult } from '../../services/ApiClient';
import { useAppState } from '../../context/AppContext';
import { useAppActions } from '../../context/useAppActions';
import { MemoEditor } from './MemoEditor';
import { OrganizedView } from './OrganizedView';
import { AiSettingsPanel } from './AiSettingsPanel';
import { Toast, Button, Loading } from '../common';
import './NotebookWorkspace.css';

export function NotebookWorkspace() {
  const { selectedNotebookId } = useAppState();
  const { goToNotebooks } = useAppActions();

  const [notebook, setNotebook] = useState<NotebookProject | null>(null);
  const [memoContent, setMemoContent] = useState<MemoContent | null>(null);
  const [organizedResult, setOrganizedResult] = useState<OrganizedResult | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // 加载笔记本项目信息
  useEffect(() => {
    if (!selectedNotebookId) return;
    (async () => {
      try {
        setPageLoading(true);
        const [notebooks, memo, organized] = await Promise.all([
          apiClient.getNotebooks(),
          apiClient.getMemo(selectedNotebookId),
          apiClient.getOrganizedResult(selectedNotebookId),
        ]);
        const nb = notebooks.find(n => n.id === selectedNotebookId) || null;
        setNotebook(nb);
        setMemoContent(memo);
        setOrganizedResult(organized);
      } catch {
        setToast({ message: '加载笔记本数据失败', type: 'error' });
      } finally {
        setPageLoading(false);
      }
    })();
  }, [selectedNotebookId]);

  // 保存备忘录
  const handleSaveMemo = useCallback(async (content: MemoContent) => {
    if (!selectedNotebookId) return;
    await apiClient.saveMemo(selectedNotebookId, content);
  }, [selectedNotebookId]);

  // 一键整理
  const handleOrganize = useCallback(async () => {
    if (!selectedNotebookId) return;
    try {
      setOrganizing(true);
      const result = await apiClient.organizeNotes(selectedNotebookId);
      setOrganizedResult(result);
      setToast({ message: '整理完成', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '整理失败，请重试';
      if (message.includes('AI_NOT_CONFIGURED') || message.includes('请先在设置中配置')) {
        setToast({ message: '请先配置 AI 设置', type: 'warning' });
        setShowAiSettings(true);
      } else {
        setToast({ message, type: 'error' });
      }
    } finally {
      setOrganizing(false);
    }
  }, [selectedNotebookId]);

  // 导出双语表达
  const handleExportExpressions = useCallback(async () => {
    if (!selectedNotebookId || !notebook) return;
    try {
      setExporting(true);
      const expressions = await apiClient.exportExpressions(selectedNotebookId);

      if (!expressions || expressions.length === 0) {
        setToast({ message: '未识别到中英双语表达，请确认备忘录中包含中英文内容', type: 'warning' });
        return;
      }

      // 使用 xlsx 生成 Excel
      const sheetData = expressions.map(e => ({ '中文': e.chinese, '英文': e.english }));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '双语表达');

      const today = new Date().toISOString().slice(0, 10);
      const filename = `${notebook.title}_双语表达_${today}.xlsx`;
      XLSX.writeFile(wb, filename);

      setToast({ message: '导出成功', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败，请重试';
      if (message.includes('AI_NOT_CONFIGURED') || message.includes('请先在设置中配置')) {
        setToast({ message: '请先配置 AI 设置', type: 'warning' });
        setShowAiSettings(true);
      } else {
        setToast({ message, type: 'error' });
      }
    } finally {
      setExporting(false);
    }
  }, [selectedNotebookId, notebook]);

  if (!selectedNotebookId) {
    return (
      <div className="notebook-workspace">
        <div className="notebook-workspace__empty">
          <p>未选择笔记本项目</p>
          <Button onClick={goToNotebooks}>返回笔记本列表</Button>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="notebook-workspace">
        <Loading text="加载笔记本..." />
      </div>
    );
  }

  return (
    <div className="notebook-workspace">
      <div className="notebook-workspace__header">
        <button className="notebook-workspace__back" onClick={goToNotebooks} title="返回笔记本列表">
          ← 返回
        </button>
        <h1 className="notebook-workspace__title">{notebook?.title || '笔记本'}</h1>
      </div>

      <div className="notebook-workspace__body">
        {/* 左侧：备忘录编辑器 */}
        <div className="notebook-workspace__left">
          {memoContent && (
            <MemoEditor
              content={memoContent}
              onSave={handleSaveMemo}
              disabled={organizing}
            />
          )}
        </div>

        {/* 中间：操作按钮区 */}
        <div className="notebook-workspace__center">
          <Button
            onClick={handleOrganize}
            disabled={organizing || exporting}
            loading={organizing}
          >
            一键整理
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportExpressions}
            disabled={organizing || exporting}
            loading={exporting}
          >
            导出双语表达
          </Button>
          <button
            className="notebook-workspace__settings-btn"
            onClick={() => setShowAiSettings(true)}
            title="AI 设置"
          >
            ⚙
          </button>
        </div>

        {/* 右侧：整理结果 */}
        <div className="notebook-workspace__right">
          <OrganizedView result={organizedResult} loading={organizing} memoContent={memoContent} />
        </div>
      </div>

      <AiSettingsPanel visible={showAiSettings} onClose={() => setShowAiSettings(false)} />

      {toast && (
        <Toast visible message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default NotebookWorkspace;
