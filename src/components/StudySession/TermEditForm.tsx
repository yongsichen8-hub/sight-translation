/**
 * TermEditForm 组件
 * 术语编辑表单 Modal：用户点击"收藏为术语"后弹出
 * 自动填入划选英文内容、语境原句，默认选中当前领域
 */

import React, { useState } from 'react';
import { Modal } from '../common/Modal/Modal';
import type { BriefingDomain, CreateTermInput } from '../../types/briefing';
import { BRIEFING_DOMAIN_LABELS } from '../../types/briefing';
import './TermCollection.css';

export interface TermEditFormProps {
  /** 是否显示 */
  visible: boolean;
  /** 划选的英文文本 */
  english: string;
  /** 自动提取的语境原句 */
  context: string;
  /** 当前新闻条目的领域（默认值） */
  defaultDomain: BriefingDomain;
  /** 当前研习会话 ID */
  studySessionId: string;
  /** 出处文章标题 */
  sourceArticleTitle: string;
  /** 保存回调 */
  onSave: (input: CreateTermInput) => Promise<void>;
  /** 关闭回调 */
  onClose: () => void;
}

const DOMAIN_OPTIONS = Object.entries(BRIEFING_DOMAIN_LABELS) as [BriefingDomain, string][];

export function TermEditForm({
  visible,
  english,
  context,
  defaultDomain,
  studySessionId,
  sourceArticleTitle,
  onSave,
  onClose,
}: TermEditFormProps): React.ReactElement {
  const [chinese, setChinese] = useState('');
  const [domain, setDomain] = useState<BriefingDomain>(defaultDomain);
  const [editableContext, setEditableContext] = useState(context);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when english/context changes (new selection)
  React.useEffect(() => {
    setChinese('');
    setDomain(defaultDomain);
    setEditableContext(context);
    setError(null);
  }, [english, context, defaultDomain]);

  const handleSave = async () => {
    const trimmedChinese = chinese.trim();
    if (!trimmedChinese) {
      setError('中文释义为必填项');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        english,
        chinese: trimmedChinese,
        domain,
        context: editableContext.trim(),
        studySessionId,
        sourceArticleTitle,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="term-edit-form__actions">
      <button
        type="button"
        className="term-edit-form__cancel-btn"
        onClick={onClose}
        disabled={saving}
      >
        取消
      </button>
      <button
        type="button"
        className="term-edit-form__save-btn"
        onClick={handleSave}
        disabled={saving || !chinese.trim()}
      >
        {saving ? '保存中...' : '保存术语'}
      </button>
    </div>
  );

  return (
    <Modal
      visible={visible}
      title="收藏术语"
      onClose={onClose}
      className="term-edit-form__modal"
      footer={footer}
    >
      <div className="term-edit-form">
        <div className="term-edit-form__field">
          <label className="term-edit-form__label" htmlFor="term-english">
            英文术语
          </label>
          <input
            id="term-english"
            type="text"
            className="term-edit-form__input term-edit-form__input--readonly"
            value={english}
            readOnly
          />
        </div>

        <div className="term-edit-form__field">
          <label className="term-edit-form__label" htmlFor="term-chinese">
            中文释义 <span className="term-edit-form__required">*</span>
          </label>
          <input
            id="term-chinese"
            type="text"
            className={`term-edit-form__input${error && !chinese.trim() ? ' term-edit-form__input--error' : ''}`}
            value={chinese}
            onChange={(e) => {
              setChinese(e.target.value);
              if (error) setError(null);
            }}
            placeholder="输入中文释义"
            autoFocus
          />
          {error && !chinese.trim() && (
            <span className="term-edit-form__error-text">{error}</span>
          )}
        </div>

        <div className="term-edit-form__field">
          <label className="term-edit-form__label" htmlFor="term-domain">
            所属领域
          </label>
          <select
            id="term-domain"
            className="term-edit-form__select"
            value={domain}
            onChange={(e) => setDomain(e.target.value as BriefingDomain)}
          >
            {DOMAIN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="term-edit-form__field">
          <label className="term-edit-form__label" htmlFor="term-context">
            语境原句
          </label>
          <textarea
            id="term-context"
            className="term-edit-form__textarea"
            value={editableContext}
            onChange={(e) => setEditableContext(e.target.value)}
            rows={3}
          />
        </div>

        {error && chinese.trim() && (
          <div className="term-edit-form__error-banner">{error}</div>
        )}
      </div>
    </Modal>
  );
}

export default TermEditForm;
