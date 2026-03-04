/**
 * ParagraphAlignEditor 组件
 *
 * 混合模式：左右双栏全文视图 + 逐段内联练习
 * - 每个段落旁有"练习此段"按钮，点击后该段落进入练习模式（显示源文、隐藏/显示译文）
 * - 段落间分隔线可点击 × 合并
 * - 点击段落文字可插入新分隔线
 * - 划词可收藏术语
 * - 顶部"确认并开始练习"保存所有段落划分后进入完整练习视图
 */

import { useState, useCallback, useRef } from 'react';
import { useAppState } from '../../context/AppContext';
import { useAppActions } from '../../context/useAppActions';
import { projectManager } from '../../services/ProjectManager';
import { expressionCollector } from '../../services/ExpressionCollector';
import { Button } from '../common/Button';
import { SaveExpressionPopup } from '../PracticeView/SaveExpressionPopup';
import type { ParagraphPair } from '../../types';
import './ParagraphAlignEditor.css';

interface SelectedTextState {
  text: string;
  sourceLanguage: 'zh' | 'en';
  position: { x: number; y: number };
}

interface SplitHint {
  side: 'zh' | 'en';
  paraIndex: number;
  charOffset: number;
  x: number;
  y: number;
}

export function ParagraphAlignEditor() {
  const state = useAppState();
  const { startPractice, exitPractice, showSuccess, showError } = useAppActions();
  const { currentProject, practiceMode } = state;

  const [pairs, setPairs] = useState<ParagraphPair[]>(() =>
    currentProject?.paragraphPairs?.map((p, i) => ({ ...p, index: i })) ?? []
  );
  const [saving, setSaving] = useState(false);

  // 已进入练习模式的段落索引集合
  const [practicedIndices, setPracticedIndices] = useState<Set<number>>(new Set());
  // 已显示译文的段落索引集合
  const [shownTranslations, setShownTranslations] = useState<Set<number>>(new Set());

  const [selectedTextState, setSelectedTextState] = useState<SelectedTextState | null>(null);
  const [savingExpression, setSavingExpression] = useState(false);
  const [splitHint, setSplitHint] = useState<SplitHint | null>(null);

  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;

  // ── 段落练习控制 ──────────────────────────────────────

  const handlePracticeThis = useCallback((index: number) => {
    setPracticedIndices(prev => new Set([...prev, index]));
    setShownTranslations(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleToggleTranslation = useCallback((index: number) => {
    setShownTranslations(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ── 合并段落 ──────────────────────────────────────────

  const handleRemoveDivider = useCallback((index: number) => {
    setPairs(prev => {
      if (index >= prev.length - 1) return prev;
      const a = prev[index]!;
      const b = prev[index + 1]!;
      const merged: ParagraphPair = {
        index,
        chinese: [a.chinese, b.chinese].filter(Boolean).join('\n'),
        english: [a.english, b.english].filter(Boolean).join('\n'),
      };
      return [...prev.slice(0, index), merged, ...prev.slice(index + 2)]
        .map((p, i) => ({ ...p, index: i }));
    });
    // 合并后重置练习状态
    setPracticedIndices(new Set());
    setShownTranslations(new Set());
  }, []);

  // ── 插入分隔线 ────────────────────────────────────────

  const handleInsertDivider = useCallback((hint: SplitHint) => {
    const { side, paraIndex, charOffset } = hint;
    setPairs(prev => {
      const pair = prev[paraIndex];
      if (!pair) return prev;
      const text = side === 'zh' ? pair.chinese : pair.english;
      if (charOffset <= 0 || charOffset >= text.length) return prev;

      const part1 = text.slice(0, charOffset).trim();
      const part2 = text.slice(charOffset).trim();
      if (!part1 || !part2) return prev;

      const newPair1: ParagraphPair = {
        index: paraIndex,
        chinese: side === 'zh' ? part1 : pair.chinese,
        english: side === 'en' ? part1 : pair.english,
      };
      const newPair2: ParagraphPair = {
        index: paraIndex + 1,
        chinese: side === 'zh' ? part2 : '',
        english: side === 'en' ? part2 : '',
      };

      return [
        ...prev.slice(0, paraIndex),
        newPair1,
        newPair2,
        ...prev.slice(paraIndex + 1),
      ].map((p, i) => ({ ...p, index: i }));
    });
    setPracticedIndices(new Set());
    setShownTranslations(new Set());
    setSplitHint(null);
  }, []);

  // ── 计算段落内字符偏移 ────────────────────────────────

  const getCharOffsetInEl = useCallback((el: HTMLElement, clientX: number, clientY: number): number => {
    let node: Node | null = null;
    let offsetInNode = 0;

    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };

    if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(clientX, clientY);
      if (pos) { node = pos.offsetNode; offsetInNode = pos.offset; }
    } else if (doc.caretRangeFromPoint) {
      const range = doc.caretRangeFromPoint(clientX, clientY);
      if (range) { node = range.startContainer; offsetInNode = range.startOffset; }
    }

    if (!node) return -1;

    // 确认 node 在 el 内
    if (!el.contains(node)) return -1;

    let accumulated = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let current: Node | null;
    while ((current = walker.nextNode())) {
      if (current === node) return accumulated + offsetInNode;
      accumulated += current.textContent?.length ?? 0;
    }
    return -1;
  }, []);

  // ── 段落点击：显示插入分隔线提示 ─────────────────────

  const handleParaClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    side: 'zh' | 'en',
    paraIndex: number
  ) => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    if ((e.target as HTMLElement).closest('.align-editor__divider, .align-editor__para-actions')) return;

    const paraEl = e.currentTarget;
    const charOffset = getCharOffsetInEl(paraEl, e.clientX, e.clientY);
    if (charOffset <= 0) return;

    const pair = pairsRef.current[paraIndex];
    if (!pair) return;
    const text = side === 'zh' ? pair.chinese : pair.english;
    if (charOffset >= text.length) return;

    setSplitHint({ side, paraIndex, charOffset, x: e.clientX, y: e.clientY + 14 });
    setSelectedTextState(null);
  }, [getCharOffsetInEl]);

  // ── 划词收藏 ──────────────────────────────────────────

  const handleMouseUp = useCallback((_e: React.MouseEvent, side: 'zh' | 'en') => {
    setTimeout(() => {
      const sel = window.getSelection();
      const selectedText = sel?.toString().trim();
      if (!selectedText || selectedText.length < 1) return;

      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedTextState({
        text: selectedText,
        sourceLanguage: side,
        position: {
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY + 8,
        },
      });
      setSplitHint(null);
    }, 0);
  }, []);

  const handleSaveExpression = useCallback(async (data: {
    chinese: string; english: string; notes: string;
  }) => {
    if (!currentProject) return;
    setSavingExpression(true);
    try {
      await expressionCollector.saveExpression({
        projectId: currentProject.id,
        chinese: data.chinese,
        english: data.english,
        notes: data.notes,
      });
      showSuccess('术语已保存');
      setSelectedTextState(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      showError(error instanceof Error && error.name === 'DuplicateError' ? '该术语已存在' : '保存失败');
    } finally {
      setSavingExpression(false);
    }
  }, [currentProject, showSuccess, showError]);

  // ── 保存并进入完整练习 ────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await projectManager.updateParagraphPairs(currentProject.id, pairs);
      startPractice({ ...currentProject, paragraphPairs: pairs }, practiceMode);
    } catch {
      showError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [currentProject, pairs, practiceMode, startPractice, showError]);

  if (!currentProject) {
    return (
      <div className="align-editor">
        <p>未找到项目</p>
        <Button onClick={exitPractice}>返回</Button>
      </div>
    );
  }

  const sourceKey = practiceMode === 'zh-to-en' ? 'chinese' : 'english';
  const targetKey = practiceMode === 'zh-to-en' ? 'english' : 'chinese';
  const sourceLabel = practiceMode === 'zh-to-en' ? '中文' : '英文';
  const targetLabel = practiceMode === 'zh-to-en' ? '英文' : '中文';

  return (
    <div
      className="align-editor"
      onMouseDown={() => { if (splitHint) setSplitHint(null); }}
    >
      {/* 顶部工具栏 */}
      <header className="align-editor__header" onMouseDown={e => e.stopPropagation()}>
        <div className="align-editor__title-row">
          <h1 className="align-editor__title">{currentProject.name}</h1>
          <span className="align-editor__subtitle">{pairs.length} 段 · 点击文字插入分隔线 · 划词收藏术语</span>
        </div>
        <div className="align-editor__header-actions">
          <Button variant="secondary" onClick={exitPractice} disabled={saving}>取消</Button>
          <Button onClick={handleConfirm} loading={saving}>确认并开始完整练习</Button>
        </div>
      </header>

      {/* 双栏内容区 */}
      <div className="align-editor__body">
        {/* 左栏：源语言（可编辑段落划分） */}
        <div className="align-editor__col">
          <div className="align-editor__col-label">{sourceLabel}</div>
          <div className="align-editor__col-content">
            {pairs.map((pair, index) => {
              const isPracticing = practicedIndices.has(index);
              const showTranslation = shownTranslations.has(index);
              const sourceText = pair[sourceKey];
              const targetText = pair[targetKey];

              return (
                <div key={index} className={`align-editor__pair-row ${isPracticing ? 'align-editor__pair-row--practicing' : ''}`}>
                  {/* 源文段落 */}
                  <div
                    className="align-editor__para"
                    onClick={e => { e.stopPropagation(); handleParaClick(e, sourceKey as 'zh' | 'en', index); }}
                    onMouseUp={e => handleMouseUp(e, sourceKey as 'zh' | 'en')}
                  >
                    <span className="align-editor__para-index">{index + 1}</span>
                    <span className="align-editor__para-text">
                      {sourceText || <span className="align-editor__empty">（空）</span>}
                    </span>
                  </div>

                  {/* 练习区域 */}
                  {isPracticing ? (
                    <div className="align-editor__practice-zone">
                      <button
                        className={`align-editor__show-btn ${showTranslation ? 'align-editor__show-btn--active' : ''}`}
                        onClick={() => handleToggleTranslation(index)}
                      >
                        {showTranslation ? `隐藏${targetLabel}` : `显示${targetLabel}`}
                      </button>
                      {showTranslation && (
                        <div
                          className="align-editor__translation"
                          onMouseUp={e => handleMouseUp(e, targetKey as 'zh' | 'en')}
                        >
                          {targetText || <span className="align-editor__empty">（空）</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="align-editor__para-actions">
                      <button
                        className="align-editor__practice-btn"
                        onClick={e => { e.stopPropagation(); handlePracticeThis(index); }}
                        title="练习此段"
                      >
                        ▶ 练习此段
                      </button>
                    </div>
                  )}

                  {/* 分隔线 */}
                  {index < pairs.length - 1 && (
                    <Divider index={index} onRemove={handleRemoveDivider} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右栏：目标语言全文（仅供参考，可划词） */}
        <div className="align-editor__col align-editor__col--reference">
          <div className="align-editor__col-label">{targetLabel}（参考）</div>
          <div className="align-editor__col-content">
            {pairs.map((pair, index) => (
              <div key={index}>
                <div
                  className="align-editor__para align-editor__para--reference"
                  onMouseUp={e => handleMouseUp(e, targetKey as 'zh' | 'en')}
                >
                  <span className="align-editor__para-index">{index + 1}</span>
                  <span className="align-editor__para-text">
                    {pair[targetKey] || <span className="align-editor__empty">（空）</span>}
                  </span>
                </div>
                {index < pairs.length - 1 && (
                  <div className="align-editor__divider align-editor__divider--passive">
                    <div className="align-editor__divider-line" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 插入分隔线提示 */}
      {splitHint && (
        <div
          className="align-editor__split-hint"
          style={{ left: splitHint.x, top: splitHint.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button className="align-editor__split-btn" onClick={() => handleInsertDivider(splitHint)}>
            ✂ 在此处插入分隔线
          </button>
          <button className="align-editor__split-cancel" onClick={() => setSplitHint(null)}>
            取消
          </button>
        </div>
      )}

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

function Divider({ index, onRemove }: { index: number; onRemove: (i: number) => void }) {
  return (
    <div className="align-editor__divider" onMouseDown={e => e.stopPropagation()}>
      <div className="align-editor__divider-line" />
      <button
        className="align-editor__divider-btn"
        title="合并相邻段落"
        onClick={e => { e.stopPropagation(); onRemove(index); }}
      >×</button>
      <div className="align-editor__divider-line" />
    </div>
  );
}

// 让 practiceMode 类型用于索引 ParagraphPair
declare module '../../types' {
  interface ParagraphPair {
    [key: string]: string | number;
  }
}

export default ParagraphAlignEditor;
