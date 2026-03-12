/**
 * StudySessionPage 组件
 * 研习会话容器：管理会话状态，协调 URL 提取流程、对照视图展示和术语收藏
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loading } from '../common';
import type { StudySession, BriefingDomain, CreateTermInput } from '../../types/briefing';

/** Minimal shape needed when creating a session from a news entry */
interface NewsEntryInput {
  id: string;
  domain: BriefingDomain;
  chineseTitle: string;
  content: string;
}
import { briefingApiClient } from '../../services/BriefingApiClient';
import { ComparisonView } from './ComparisonView';
import { TermEditForm } from './TermEditForm';
import type { TextSelectionData } from './TextSelectionPopup';
import './StudySession.css';

export interface StudySessionPageProps {
  sessionId?: string;
  newsEntry?: NewsEntryInput;
  onBack?: () => void;
}

export function StudySessionPage({
  sessionId,
  newsEntry,
  onBack,
}: StudySessionPageProps): React.ReactElement {
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Term collection state
  const [savedTerms, setSavedTerms] = useState<string[]>([]);
  const [termFormVisible, setTermFormVisible] = useState(false);
  const [selectionData, setSelectionData] = useState<TextSelectionData | null>(null);

  // Determine the domain from the newsEntry or default to 'ai-tech'
  const currentDomain: BriefingDomain = newsEntry?.domain || 'ai-tech';

  // 初始化会话：加载已有会话或从 newsEntry 创建新会话
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        let loaded: StudySession;

        if (sessionId) {
          loaded = await briefingApiClient.getStudySession(sessionId);
        } else if (newsEntry) {
          loaded = await briefingApiClient.createStudySession({
            newsEntryId: newsEntry.id,
            newsDate: new Date().toISOString().slice(0, 10),
            chineseTitle: newsEntry.chineseTitle,
            chineseContent: newsEntry.content,
          });
        } else {
          throw new Error('需要提供 sessionId 或 newsEntry');
        }

        if (!cancelled) {
          setSession(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载会话失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [sessionId, newsEntry]);

  // Load saved terms for this session
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function loadTerms() {
      try {
        const terms = await briefingApiClient.getTerms();
        if (!cancelled) {
          // Filter terms belonging to this session and extract english strings
          const sessionTerms = terms
            .filter((t) => t.studySessionId === session.id)
            .map((t) => t.english);
          setSavedTerms(sessionTerms);
        }
      } catch {
        // Non-critical: silently ignore term loading errors
      }
    }

    loadTerms();
    return () => { cancelled = true; };
  }, [session]);

  // 提交英文报道 URL 进行正文提取
  const handleSubmitUrl = useCallback(async (url: string) => {
    if (!session) return;

    try {
      setExtractLoading(true);
      setExtractError(null);

      await briefingApiClient.extractEnglishContent(session.id, url);

      // 提取成功后重新加载会话以获取更新后的状态
      const updated = await briefingApiClient.getStudySession(session.id);
      setSession(updated);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : '提取英文正文失败，请检查链接或手动粘贴正文'
      );
    } finally {
      setExtractLoading(false);
    }
  }, [session]);

  // 手动粘贴英文正文
  const handleManualPaste = useCallback(async (text: string) => {
    if (!session) return;

    try {
      setExtractLoading(true);
      setExtractError(null);

      await briefingApiClient.updateStudySession(session.id, {
        englishContent: text,
        englishHtmlContent: text.split('\n').map(p => `<p>${p}</p>`).join(''),
        englishSourceName: '手动粘贴',
        status: 'completed',
      });

      const updated = await briefingApiClient.getStudySession(session.id);
      setSession(updated);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setExtractLoading(false);
    }
  }, [session]);

  // Handle term selection from TextSelectionPopup
  const handleTermSelect = useCallback((data: TextSelectionData) => {
    setSelectionData(data);
    setTermFormVisible(true);
  }, []);

  // Handle term save from TermEditForm
  const handleTermSave = useCallback(async (input: CreateTermInput) => {
    const term = await briefingApiClient.createTerm(input);
    setSavedTerms((prev) => [...prev, term.english]);
  }, []);

  const handleTermFormClose = useCallback(() => {
    setTermFormVisible(false);
    setSelectionData(null);
  }, []);

  if (loading) {
    return (
      <div className="study-session">
        <Loading text="加载研习会话..." />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="study-session">
        <div className="study-session__header">
          {onBack && (
            <button className="study-session__back-btn" onClick={onBack}>
              ← 返回简报
            </button>
          )}
        </div>
        <div className="study-session__error">
          <p>{error || '会话不存在'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="study-session">
      <div className="study-session__header">
        {onBack && (
          <button className="study-session__back-btn" onClick={onBack}>
            ← 返回简报
          </button>
        )}
        <h1 className="study-session__title">{session.chineseTitle}</h1>
      </div>
      <ComparisonView
        chineseTitle={session.chineseTitle}
        chineseContent={session.chineseContent}
        status={session.status}
        englishContent={session.englishContent}
        englishHtmlContent={session.englishHtmlContent}
        englishSourceName={session.englishSourceName}
        englishUrl={session.englishUrl}
        extractLoading={extractLoading}
        extractError={extractError}
        onSubmitUrl={handleSubmitUrl}
        onManualPaste={handleManualPaste}
        savedTerms={savedTerms}
        onTermSelect={handleTermSelect}
      />
      {selectionData && (
        <TermEditForm
          visible={termFormVisible}
          english={selectionData.selectedText}
          context={selectionData.contextSentence}
          defaultDomain={currentDomain}
          studySessionId={session.id}
          sourceArticleTitle={session.chineseTitle}
          onSave={handleTermSave}
          onClose={handleTermFormClose}
        />
      )}
    </div>
  );
}

export default StudySessionPage;
