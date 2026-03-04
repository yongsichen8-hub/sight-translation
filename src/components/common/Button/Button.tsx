/**
 * Button 组件
 * 通用按钮组件，支持多种变体和状态
 */

import React from 'react';
import './Button.css';

/**
 * Button 变体类型
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * Button 尺寸类型
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Button Props 接口
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否占满宽度 */
  fullWidth?: boolean;
  /** 子元素 */
  children: React.ReactNode;
}

/**
 * Button 组件
 * 支持多种样式变体、尺寸和加载状态
 */
export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        button
        button--${variant}
        button--${size}
        ${fullWidth ? 'button--full-width' : ''}
        ${loading ? 'button--loading' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="button__spinner" aria-hidden="true">
          <span className="button__spinner-circle"></span>
        </span>
      )}
      <span className={`button__content ${loading ? 'button__content--hidden' : ''}`}>
        {children}
      </span>
      {loading && <span className="sr-only">加载中</span>}
    </button>
  );
}

export default Button;
