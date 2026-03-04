/**
 * FileUpload 组件
 * 文件上传组件，支持拖拽上传和点击选择
 */

import React, { useState, useCallback, useRef, useId } from 'react';
import './FileUpload.css';

/**
 * 支持的文件类型
 */
const ACCEPTED_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ACCEPTED_EXTENSIONS = '.txt,.pdf,.doc,.docx';

/**
 * FileUpload Props 接口
 */
export interface FileUploadProps {
  /** 标签文本 */
  label: string;
  /** 选中的文件 */
  file: File | null;
  /** 文件变更回调 */
  onChange: (file: File | null) => void;
  /** 错误信息 */
  error?: string | null;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 检查文件类型是否支持
 */
function isValidFileType(file: File): boolean {
  // 检查 MIME 类型
  if (ACCEPTED_TYPES.includes(file.type)) {
    return true;
  }
  // 检查文件扩展名（某些浏览器可能不提供正确的 MIME 类型）
  const extension = file.name.toLowerCase().split('.').pop();
  return ['txt', 'pdf', 'doc', 'docx'].includes(extension || '');
}

/**
 * FileUpload 组件
 * 支持拖拽上传和点击选择文件
 */
export function FileUpload({
  label,
  file,
  onChange,
  error,
  required = false,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(
    (selectedFile: File | null) => {
      if (disabled) return;

      if (selectedFile && !isValidFileType(selectedFile)) {
        // 不支持的文件类型，不做任何处理
        return;
      }

      onChange(selectedFile);
    },
    [disabled, onChange]
  );

  /**
   * 处理 input change 事件
   */
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0] || null;
      handleFileSelect(selectedFile);
    },
    [handleFileSelect]
  );

  /**
   * 处理拖拽进入
   */
  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  /**
   * 处理文件放置
   */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFile = event.dataTransfer.files?.[0] || null;
      handleFileSelect(droppedFile);
    },
    [disabled, handleFileSelect]
  );

  /**
   * 清除已选文件
   */
  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(null);
      // 重置 input 值
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onChange]
  );

  /**
   * 获取 dropzone 类名
   */
  const getDropzoneClassName = (): string => {
    const classes = ['file-upload__dropzone'];
    if (isDragOver) classes.push('file-upload__dropzone--dragover');
    if (file) classes.push('file-upload__dropzone--has-file');
    if (error) classes.push('file-upload__dropzone--error');
    return classes.join(' ');
  };

  return (
    <div className="file-upload">
      <label className="file-upload__label" htmlFor={inputId}>
        {label}
        {required && <span className="file-upload__required">*</span>}
      </label>

      <div
        className={getDropzoneClassName()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="file-upload__input"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          disabled={disabled}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-invalid={!!error}
        />

        <div className="file-upload__content">
          {file ? (
            <div className="file-upload__file-info">
              <span className="file-upload__icon">📄</span>
              <span className="file-upload__file-name">{file.name}</span>
              <span className="file-upload__file-size">
                ({formatFileSize(file.size)})
              </span>
              <button
                type="button"
                className="file-upload__clear"
                onClick={handleClear}
                aria-label="清除已选文件"
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <div className="file-upload__icon">📁</div>
              <p className="file-upload__text">
                拖拽文件到此处，或点击选择文件
              </p>
              <p className="file-upload__hint">
                支持 TXT、PDF、Word (.doc, .docx) 格式
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          id={`${inputId}-error`}
          className="file-upload__error"
          role="alert"
        >
          <span className="file-upload__error-icon">⚠️</span>
          {error}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
