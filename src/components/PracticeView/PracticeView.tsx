/**
 * PracticeView 组件
 * 统一视图：左右双栏 Word 式排版
 * - 右上角固定工具栏：编辑/练习模式切换 + 退出
 * - 编辑模式：两栏都是 textarea，直接编辑，Enter 分段，Backspace 合并
 * - 练习模式：两栏只读，划词可收藏术语
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
  
  // 编辑模式下的文本（整段文本，用换行符分隔段落）
  const [chineseText, setChineseText] = useState('');
  const [englishText, setEnglishText] = useState('');
  
  // 划词收藏
  const [selectedTextState, setSelectedTextState] = useState<SelectedTextState | null>(null);
  const [savingExpression, setSavingExpression] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const hasInitialized = useRef(false);
  const [contentReady, setContentReady] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  
  // 跳转输入
  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpInputValue, setJumpInputValue] = useState('');
  const jumpInputRef = useRef<HTMLInputElement>(null);

  // 高亮关键词
  const { chineseKeywords, englishKeywords, refresh: refreshExpressions } = useProjectExpressions(currentProject?.id);
  
  // DOM refs for scroll position preservation
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
      hasInitialized.current = true;
      setContentReady(true);
    }
  }, [currentProject]);

  // 初始化上次进度百分比显示（不自动滚动，用户可手动跳转）
  useEffect(() => {
    if (!contentReady || !currentProject?.practiceProgress) return;
    const { scrollPercentage } = currentProject.practiceProgress;
    if (scrollPercentage > 0) {
      setScrollPercent(Math.round(scrollPercentage * 100));
    }
  }, [contentReady, currentProject]);

  // 实时追踪滚动进度
  useEffect(() => {
    const el = leftColRef.current;
    if (!el || viewMode !== 'practice') return;
    const handleScroll = () => {
      const pct = calculateScrollPercentage(el as HTMLElement);
      setScrollPercent(Math.round(pct * 100));
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewMode, contentReady]);

  // 模式切换后恢复滚动位置
  useEffect(() => {
    if (!shouldRestoreScroll.current) return;
    // 等待 DOM 完全渲染
    const timer = setTimeout(() => {
      if (leftColRef.current) {
        leftColRef.current.scrollTop = scrollPositionRef.current.left;
      }
      if (rightColRef.current) {
        rightColRef.current.scrollTop = scrollPositionRef.current.right;
      }
      shouldRestoreScroll.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [viewMode]);

  // 从文本构建 paragraphPairs
  const buildPairs = useCallback((): ParagraphPair[] => {
    const zhParagraphs = chineseText.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const enParagraphs = englishText.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const maxLen = Math.max(zhParagraphs.length, enParagraphs.length);
    const pairs: ParagraphPair[] = [];
    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        index: i,
        chinese: zhParagraphs[i] || '',
        english: enParagraphs[i] || '',
      });
    }
    return pairs;
  }, [chineseText, englishText]);

  // 保存当前滚动位置
  const saveScrollPosition = useCallback(() => {
    if (leftColRef.current) {
      scrollPositionRef.current.left = leftColRef.current.scrollTop;
    }
    if (rightColRef.current) {
      scrollPositionRef.current.right = rightColRef.current.scrollTop;
    }
  }, []);

  // 切换到练习模式时保存
  const handleSwitchToPractice = useCallback(async () => {
    saveScrollPosition();
    shouldRestoreScroll.current = true;
    
    if (currentProject && viewMode === 'edit') {
      try {
        setSaving(true);
        const pairs = buildPairs();
        await dataService.updateProjectParagraphs(currentProject.id, pairs);
        showSuccess('已保存');
      } catch {
        showError('保存失败');
      } finally {
        setSaving(false);
      }
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

  // 退出时保存
  const handleExit = useCallback(async () => {
    // 保存练习进度（滚动位置）
    if (currentProject && leftColRef.current) {
      try {
        const scrollPercentage = calculateScrollPercentage(leftColRef.current as HTMLElement);
        await dataService.updateProjectProgress(currentProject.id, {
          scrollPercentage,
          updatedAt: new Date().toISOString(),
        });
      } catch { /* 静默处理，不阻断退出 */ }
    }

    if (currentProject && viewMode === 'edit') {
      try {
        const pairs = buildPairs();
        await dataService.updateProjectParagraphs(currentProject.id, pairs);
      } catch { /* 静默 */ }
    }
    exitPractice();
  }, [currentProject, viewMode, buildPairs, exitPractice]);

  // 跳转到指定百分比
  const handleJumpToPercent = useCallback((percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const ratio = clamped / 100;
    if (leftColRef.current) {
      restoreScrollPosition(leftColRef.current as HTMLElement, ratio);
    }
    if (rightColRef.current) {
      restoreScrollPosition(rightColRef.current as HTMLElement, ratio);
    }
    setScrollPercent(clamped);
    setJumpInputVisible(false);
    setJumpInputValue('');
  }, []);

  // 打开跳转输入框
  const handleOpenJumpInput = useCallback(() => {
    setJumpInputValue(String(scrollPercent));
    setJumpInputVisible(true);
    setTimeout(() => jumpInputRef.current?.select(), 0);
  }, [scrollPercent]);

  // 跳转输入框按键处理
  const handleJumpKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(jumpInputValue, 10);
      if (!isNaN(val)) {
        handleJumpToPercent(val);
      }
    } else if (e.key === 'Escape') {
      setJumpInputVisible(false);
      setJumpInputValue('');
    }
  }, [jumpInputValue, handleJumpToPercent]);

  // 划词收藏（仅练习模式）
  const handleMouseUp = useCallback((side: 'zh' | 'en') => {
    if (viewMode !== 'practice') return;
    
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < 1) return;
      
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedTextState({
        text,
        sourceLanguage: side,
        position: { x: rect.left, y: rect.bottom + 8 },
      });
    }, 0);
  }, [viewMode]);

  const handleSaveExpression = useCallback(async (data: {
    chinese: string; english: string; notes: string;
  }) => {
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
    } finally {
      setSavingExpression(false);
    }
  }, [currentProject, showSuccess, showError, refreshExpressions]);

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
          <button
            className={`pv__tab ${viewMode === 'edit' ? 'pv__tab--active' : ''}`}
            onClick={handleSwitchToEdit}
            disabled={saving}
          >
            编辑
          </button>
          <button
            className={`pv__tab ${viewMode === 'practice' ? 'pv__tab--active' : ''}`}
            onClick={handleSwitchToPractice}
            disabled={saving}
          >
            练习
          </button>
        </div>
        <button className="pv__btn pv__btn--ghost" onClick={handleExit} disabled={saving}>
          退出
        </button>
        {viewMode === 'practice' && (
          jumpInputVisible ? (
            <div className="pv__jump-input-wrap">
              <input
                ref={jumpInputRef}
                className="pv__jump-input"
                type="number"
                min={0}
                max={100}
                value={jumpInputValue}
                onChange={e => setJumpInputValue(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                onBlur={() => { setJumpInputVisible(false); setJumpInputValue(''); }}
                placeholder="0-100"
              />
              <span className="pv__jump-input-suffix">%</span>
            </div>
          ) : (
            <button
              className="pv__progress-badge"
              onClick={handleOpenJumpInput}
              title="点击输入百分比跳转"
            >
              {scrollPercent}%
            </button>
          )
        )}
      </div>

      {/* 双栏内容区 */}
      <div className="pv__body">
        {/* 左栏：中文 */}
        <div className="pv__col">
          <div className="pv__col-label">中文</div>
          {viewMode === 'edit' ? (
            <textarea
              ref={leftColRef as React.RefObject<HTMLTextAreaElement>}
              className="pv__editor"
              value={chineseText}
              onChange={e => setChineseText(e.target.value)}
              placeholder="在此编辑中文内容，用空行分隔段落..."
            />
          ) : (
            <div
              ref={leftColRef as React.RefObject<HTMLDivElement>}
              className="pv__content"
              onMouseUp={() => handleMouseUp('zh')}
            >
              {chineseText ? <HighlightedText text={chineseText} keywords={chineseKeywords} /> : <span className="pv__empty-text">（无内容）</span>}
            </div>
          )}
        </div>

        {/* 右栏：英文 */}
        <div className="pv__col">
          <div className="pv__col-label">英文</div>
          {viewMode === 'edit' ? (
            <textarea
              ref={rightColRef as React.RefObject<HTMLTextAreaElement>}
              className="pv__editor"
              value={englishText}
              onChange={e => setEnglishText(e.target.value)}
              placeholder="在此编辑英文内容，用空行分隔段落..."
            />
          ) : (
            <div
              ref={rightColRef as React.RefObject<HTMLDivElement>}
              className="pv__content"
              onMouseUp={() => handleMouseUp('en')}
            >
              {englishText ? <HighlightedText text={englishText} keywords={englishKeywords} /> : <span className="pv__empty-text">（无内容）</span>}
            </div>
          )}
        </div>
      </div>

      {/* 划词收藏 popup */}
      {selectedTextState && (
        <SaveExpressionPopup
          selectedText={selectedTextState.text}
          sourceLanguage={selectedTextState.sourceLanguage}
          position={selectedTextState.position}
          onSave={handleSaveExpression}
          onCancel={() => {
            setSelectedTextState(null);
            window.getSelection()?.removeAllRanges();
          }}
          saving={savingExpression}
        />
      )}
    </div>
  );
}

export default PracticeView;
