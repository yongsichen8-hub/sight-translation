/**
 * Modal 组件
 * 模态对话框组件，支持无障碍访问
 */

import React, { useEffect, useRef, useCallback } from 'react';
import './Modal.css';

/**
 * Modal Props 接口
 */
export interface ModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 标题 */
  title?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 子元素 */
  children: React.ReactNode;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 底部操作区域 */
  footer?: React.ReactNode;
}

/**
 * Modal 组件
 * 支持键盘导航和焦点管理的模态对话框
 */
export function Modal({
  visible,
  title,
  onClose,
  children,
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
  footer,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // 打开时保存当前焦点元素，关闭时恢复
  useEffect(() => {
    if (visible) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // 聚焦到模态框
      modalRef.current?.focus();
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [visible]);

  // 阻止背景滚动
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      // Tab 键焦点陷阱
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [onClose]
  );

  // 点击遮罩关闭
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  if (!visible) {
    return null;
  }

  return (
    <div
      className="modal__overlay"
      onClick={handleOverlayClick}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && (
              <h2 id="modal-title" className="modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                className="modal__close"
                onClick={onClose}
                aria-label="关闭对话框"
                type="button"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
