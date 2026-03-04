/**
 * Toast 组件
 * 用于显示错误提示、成功消息等通知
 */

import React, { useEffect, useCallback } from 'react';
import './Toast.css';

/**
 * Toast 类型
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast Props 接口
 */
export interface ToastProps {
  /** 消息内容 */
  message: string;
  /** Toast 类型 */
  type?: ToastType;
  /** 显示时长（毫秒），0 表示不自动关闭 */
  duration?: number;
  /** 是否可见 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * Toast 组件
 * 支持多种类型的消息提示，自动消失或手动关闭
 */
export function Toast({
  message,
  type = 'info',
  duration = 3000,
  visible,
  onClose,
  className = '',
}: ToastProps) {
  // 自动关闭逻辑
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        onClose();
      }
    },
    [onClose]
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`toast toast--${type} ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      onKeyDown={handleKeyDown}
    >
      <span className="toast__icon" aria-hidden="true">
        {getIcon(type)}
      </span>
      <span className="toast__message">{message}</span>
      <button
        className="toast__close"
        onClick={onClose}
        aria-label="关闭提示"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

/**
 * 根据类型获取图标
 */
function getIcon(type: ToastType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

export default Toast;
