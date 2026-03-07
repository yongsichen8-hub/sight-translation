/**
 * UrlInputForm 组件
 * 英文报道 URL 输入表单，支持加载状态、错误提示和手动粘贴入口
 */

import React, { useState } from 'react';

interface UrlInputFormProps {
  onSubmitUrl: (url: string) => void;
  onManualPaste: (text: string) => void;
  loading: boolean;
  error: string | null;
}

export function UrlInputForm({
  onSubmitUrl,
  onManualPaste,
  loading,
  error,
}: UrlInputFormProps): React.ReactElement {
  const [url, setUrl] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      onSubmitUrl(trimmed);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualText.trim();
    if (trimmed) {
      onManualPaste(trimmed);
    }
  };

  return (
    <div className="url-input-form">
      {!showManualInput ? (
        <>
          <div className="url-input-form__prompt">
            <p className="url-input-form__prompt-text">
              请粘贴与此新闻相关的英文报道链接
            </p>
          </div>

          <form className="url-input-form__form" onSubmit={handleSubmit}>
            <input
              type="url"
              className="url-input-form__input"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              aria-label="英文报道 URL"
            />
            <button
              type="submit"
              className="url-input-form__submit"
              disabled={loading || !url.trim()}
            >
              {loading ? '提取中...' : '提取正文'}
            </button>
          </form>

          {error && (
            <div className="url-input-form__error">
              <p className="url-input-form__error-text">{error}</p>
              <button
                type="button"
                className="url-input-form__manual-btn"
                onClick={() => setShowManualInput(true)}
              >
                手动粘贴正文
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="url-input-form__prompt">
            <p className="url-input-form__prompt-text">
              请将英文报道正文粘贴到下方
            </p>
          </div>

          <form className="url-input-form__form url-input-form__form--manual" onSubmit={handleManualSubmit}>
            <textarea
              className="url-input-form__textarea"
              placeholder="在此粘贴英文报道正文..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={12}
              aria-label="英文报道正文"
            />
            <div className="url-input-form__actions">
              <button
                type="button"
                className="url-input-form__back-btn"
                onClick={() => setShowManualInput(false)}
              >
                返回 URL 输入
              </button>
              <button
                type="submit"
                className="url-input-form__submit"
                disabled={!manualText.trim()}
              >
                确认
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
