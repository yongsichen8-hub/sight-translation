/**
 * PracticeView 组件
 * 统一视图：左右双栏 Word 式排版
 * - 右上角固定工具栏：编辑/练习模式切换 + 退出
 * - 编辑模式：两栏都是 textarea，直接编辑，Enter 分段，Backspace 合并
 * - 练习模式：两栏只读，划词可收藏术语
 * - 每栏独立进度百分比显示 + 点击跳转
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState } from '../../context/AppContext';
import { useAppActions } from '../../context/useAppActions';
import { dataService } from '../../services/DataService';
import { SaveExpressionPopup } from './SaveExpressionPopup';
import { HighlightedText } from './HighlightedText';
import { useProjectExpressions } from './useProjectExpressions';
import { calculateScrollPercentage, restoreScrollPosition } from './scrollUtils';
import type { ParagraphPair } from '../../types';
import './PracticeView.css';

type ViewMode = 'edit' | 'practice';

interface SelectedTextState {
  text: string;
  sourceLanguage: 'zh' | 'en';
  position: { x: number; y: number };
}

export function PracticeView() {
  const state = useAppState();
  const { exitPractice, showSuccess, showError } = useAppActions();
  const { currentProject } = state;

  const [viewMode, setViewMode] = useState<ViewMode>('practice');
  const [chineseText, setChineseText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [selectedTextState, setSelectedTextState] = useState<SelectedTextState | null>(null);
  const [savingExpression, setSavingExpression] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasInitialized = useRef(false);
  const [contentReady, setContentReady] = useState(false);

  // 累计练习计时
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const practiceSecondsRef = useRef(0);

  // 独立的中英文进度
  const [zhPercent, setZhPercent] = useState(0);
  const [enPercent, setEnPercent] = useState(0);
  // 独立的跳转输入状态
  const [zhJumpVisible, setZhJumpVisible] = useState(false);
  const [enJumpVisible, setEnJumpVisible] = useState(false);
  const [zhJumpValue, setZhJumpValue] = useState('');
  const [enJumpValue, setEnJumpValue] = useState('');
  const zhJumpRef = useRef<HTMLInputElement>(null);
  const enJumpRef = useRef<HTMLInputElement>(null);

  const { chineseKeywords, englishKeywords, refresh: refreshExpressions } = useProjectExpressions(currentProject?.id);

  const leftColRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  const scrollPositionRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const shouldRestoreScroll = useRef(false);

  // 初始化：从 paragraphPairs 构建文本
  useEffect(() => {
    if (currentProject && !hasInitialized.current) {
      const pairs = currentProject.paragraphPairs || [];
      setChineseText(pairs.map(p => p.chinese).join('\n\n'));
      setEnglishText(pairs.map(p => p.english).join('\n\n'));
      // 恢复累计练习时间
      const savedTime = currentProject.practiceProgress?.practiceTimeSeconds ?? 0;
      setPracticeSeconds(savedTime);
      practiceSecondsRef.current = savedTime;
      hasInitialized.current = true;
      setContentReady(true);
    }
  }, [currentProject]);

  // 练习计时器：每秒递增
  useEffect(() => {
    const timer = setInterval(() => {
      setPracticeSeconds(prev => {
        const next = prev + 1;
        practiceSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 初始化上次进度百分比显示
  useEffect(() => {
    if (!contentReady || !currentProject?.practiceProgress) return;
    const { scrollPercentage } = currentProject.practiceProgress;
    if (scrollPercentage > 0) {
      const pct = Math.round(scrollPercentage * 100);
      setZhPercent(pct);
      setEnPercent(pct);
    }
  }, [contentReady, currentProject]);

  // 实时追踪中文栏滚动进度
  useEffect(() => {
    const el = leftColRef.current;
    if (!el || viewMode !== 'practice') return;
    const handleScroll = () => {
      setZhPercent(Math.round(calculateScrollPercentage(el as HTMLElement) * 100));
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewMode, contentReady]);

  // 实时追踪英文栏滚动进度
  useEffect(() => {
    const el = rightColRef.current;
    if (!el || viewMode !== 'practice') return;
    const handleScroll = () => {
      setEnPercent(Math.round(calculateScrollPercentage(el as HTMLElement) * 100));
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewMode, contentReady]);

  // 模式切换后恢复滚动位置
  useEffect(() => {
    if (!shouldRestoreScroll.current) return;
    const timer = setTimeout(() => {
      if (leftColRef.current) leftColRef.current.scrollTop = scrollPositionRef.current.left;
      if (rightColRef.current) rightColRef.current.scrollTop = scrollPositionRef.current.right;
      shouldRestoreScroll.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [viewMode]);

  const buildPairs = useCallback((): ParagraphPair[] => {
    const zhParagraphs = chineseText.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const enParagraphs = englishText.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const maxLen = Math.max(zhParagraphs.length, enParagraphs.length);
    const pairs: ParagraphPair[] = [];
    for (let i = 0; i < maxLen; i++) {
      pairs.push({ index: i, chinese: zhParagraphs[i] || '', english: enParagraphs[i] || '' });
    }
    return pairs;
  }, [chineseText, englishText]);

  const saveScrollPosition = useCallback(() => {
    if (leftColRef.current) scrollPositionRef.current.left = leftColRef.current.scrollTop;
    if (rightColRef.current) scrollPositionRef.current.right = rightColRef.current.scrollTop;
  }, []);

  const handleSwitchToPractice = useCallback(async () => {
    saveScrollPosition();
    shouldRestoreScroll.current = true;
    if (currentProject && viewMode === 'edit') {
      try {
        setSaving(true);
        const pairs = buildPairs();
        await dataService.updateProjectParagraphs(currentProject.id, pairs);
        showSuccess('已保存');
      } catch { showError('保存失败'); }
      finally { setSaving(false); }
    }
    setViewMode('practice');
    setSelectedTextState(null);
  }, [currentProject, viewMode, buildPairs, showSuccess, showError, saveScrollPosition]);

  const handleSwitchToEdit = useCallback(() => {
    saveScrollPosition();
    shouldRestoreScroll.current = true;
    setViewMode('edit');
    setSelectedTextState(null);
  }, [saveScrollPosition]);

  const handleExit = useCallback(async () => {
    if (currentProject && leftColRef.current) {
      try {
        const scrollPercentage = calculateScrollPercentage(leftColRef.current as HTMLElement);
        await dataService.updateProjectProgress(currentProject.id, {
          scrollPercentage,
          practiceTimeSeconds: practiceSecondsRef.current,
          updatedAt: new Date().toISOString(),
        });
      } catch { /* 静默 */ }
    }
    if (currentProject && viewMode === 'edit') {
      try {
        const pairs = buildPairs();
        await dataService.updateProjectParagraphs(currentProject.id, pairs);
      } catch { /* 静默 */ }
    }
    exitPractice();
  }, [currentProject, viewMode, buildPairs, exitPractice]);

  // 跳转：中文栏
  const handleZhJump = useCallback((percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    if (leftColRef.current) restoreScrollPosition(leftColRef.current as HTMLElement, clamped / 100);
    setZhPercent(clamped);
    setZhJumpVisible(false);
    setZhJumpValue('');
  }, []);

  // 跳转：英文栏
  const handleEnJump = useCallback((percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    if (rightColRef.current) restoreScrollPosition(rightColRef.current as HTMLElement, clamped / 100);
    setEnPercent(clamped);
    setEnJumpVisible(false);
    setEnJumpValue('');
  }, []);

  const handleMouseUp = useCallback((side: 'zh' | 'en') => {
    if (viewMode !== 'practice') return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < 1) return;
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedTextState({ text, sourceLanguage: side, position: { x: rect.left, y: rect.bottom + 8 } });
    }, 0);
  }, [viewMode]);

  const handleSaveExpression = useCallback(async (data: { chinese: string; english: string; notes: string }) => {
    if (!currentProject) return;
    setSavingExpression(true);
    try {
      await dataService.saveExpression({ projectId: currentProject.id, ...data });
      showSuccess('术语已保存');
      await refreshExpressions();
      setSelectedTextState(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      showError(error instanceof Error && error.name === 'DuplicateError' ? '该术语已存在' : '保存失败');
    } finally { setSavingExpression(false); }
  }, [currentProject, showSuccess, showError, refreshExpressions]);

  // 格式化秒数为 HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!currentProject) {
    return (
      <div className="pv">
        <div className="pv__empty">
          <p>请先选择一个项目</p>
          <button className="pv__btn" onClick={exitPractice}>返回</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pv">
      {/* 固定右上角工具栏 */}
      <div className="pv__toolbar">
        <div className="pv__toolbar-tabs">
          <button className={`pv__tab ${viewMode === 'edit' ? 'pv__tab--active' : ''}`} onClick={handleSwitchToEdit} disabled={saving}>编辑</button>
          <button className={`pv__tab ${viewMode === 'practice' ? 'pv__tab--active' : ''}`} onClick={handleSwitchToPractice} disabled={saving}>练习</button>
        </div>
        <button className="pv__btn pv__btn--ghost" onClick={handleExit} disabled={saving}>退出</button>
      </div>

      {/* 双栏内容区 */}
      <div className="pv__body">
        {/* 左栏：中文 */}
        <div className="pv__col">
          <div className="pv__col-label">
            <span>中文</span>
            {viewMode === 'practice' && (
              zhJumpVisible ? (
                <div className="pv__jump-input-wrap">
                  <input
                    ref={zhJumpRef}
                    className="pv__jump-input"
                    type="number"
                    min={0}
                    max={100}
                    value={zhJumpValue}
                    onChange={e => setZhJumpValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = parseInt(zhJumpValue, 10); if (!isNaN(v)) handleZhJump(v); }
                      else if (e.key === 'Escape') { setZhJumpVisible(false); setZhJumpValue(''); }
                    }}
                    onBlur={() => { setZhJumpVisible(false); setZhJumpValue(''); }}
                    placeholder="0-100"
                  />
                  <span className="pv__jump-input-suffix">%</span>
                </div>
              ) : (
                <button
                  className="pv__progress-badge"
                  onClick={() => { setZhJumpValue(String(zhPercent)); setZhJumpVisible(true); setTimeout(() => zhJumpRef.current?.select(), 0); }}
                  title="点击输入百分比跳转"
                >{zhPercent}%</button>
              )
            )}
          </div>
          {viewMode === 'edit' ? (
            <textarea
              ref={leftColRef as React.RefObject<HTMLTextAreaElement>}
              className="pv__editor"
              value={chineseText}
              onChange={e => setChineseText(e.target.value)}
              placeholder="在此编辑中文内容，用空行分隔段落..."
            />
          ) : (
            <div ref={leftColRef as React.RefObject<HTMLDivElement>} className="pv__content" onMouseUp={() => handleMouseUp('zh')}>
              {chineseText ? <HighlightedText text={chineseText} keywords={chineseKeywords} /> : <span className="pv__empty-text">（无内容）</span>}
            </div>
          )}
        </div>

        {/* 右栏：英文 */}
        <div className="pv__col">
          <div className="pv__col-label">
            <span>英文</span>
            {viewMode === 'practice' && (
              enJumpVisible ? (
                <div className="pv__jump-input-wrap">
                  <input
                    ref={enJumpRef}
                    className="pv__jump-input"
                    type="number"
                    min={0}
                    max={100}
                    value={enJumpValue}
                    onChange={e => setEnJumpValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = parseInt(enJumpValue, 10); if (!isNaN(v)) handleEnJump(v); }
                      else if (e.key === 'Escape') { setEnJumpVisible(false); setEnJumpValue(''); }
                    }}
                    onBlur={() => { setEnJumpVisible(false); setEnJumpValue(''); }}
                    placeholder="0-100"
                  />
                  <span className="pv__jump-input-suffix">%</span>
                </div>
              ) : (
                <button
                  className="pv__progress-badge"
                  onClick={() => { setEnJumpValue(String(enPercent)); setEnJumpVisible(true); setTimeout(() => enJumpRef.current?.select(), 0); }}
                  title="点击输入百分比跳转"
                >{enPercent}%</button>
              )
            )}
          </div>
          {viewMode === 'edit' ? (
            <textarea
              ref={rightColRef as React.RefObject<HTMLTextAreaElement>}
              className="pv__editor"
              value={englishText}
              onChange={e => setEnglishText(e.target.value)}
              placeholder="在此编辑英文内容，用空行分隔段落..."
            />
          ) : (
            <div ref={rightColRef as React.RefObject<HTMLDivElement>} className="pv__content" onMouseUp={() => handleMouseUp('en')}>
              {englishText ? <HighlightedText text={englishText} keywords={englishKeywords} /> : <span className="pv__empty-text">（无内容）</span>}
            </div>
          )}
        </div>
      </div>

      {selectedTextState && (
        <SaveExpressionPopup
          selectedText={selectedTextState.text}
          sourceLanguage={selectedTextState.sourceLanguage}
          position={selectedTextState.position}
          onSave={handleSaveExpression}
          onCancel={() => { setSelectedTextState(null); window.getSelection()?.removeAllRanges(); }}
          saving={savingExpression}
        />
      )}

      {/* 左下角累计计时 */}
      <div className="pv__timer">{formatTime(practiceSeconds)}</div>
    </div>
  );
}

export default PracticeView;