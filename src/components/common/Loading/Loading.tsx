/**
 * Loading 组件
 * 用于显示加载状态
 */

import React from 'react';
import './Loading.css';

/**
 * Loading 尺寸类型
 */
export type LoadingSize = 'small' | 'medium' | 'large';

/**
 * Loading Props 接口
 */
export interface LoadingProps {
  /** 加载提示文本 */
  text?: string;
  /** 尺寸 */
  size?: LoadingSize;
  /** 是否全屏覆盖 */
  fullscreen?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * Loading 组件
 * 支持不同尺寸和全屏模式的加载指示器
 */
export function Loading({
  text = '加载中...',
  size = 'medium',
  fullscreen = false,
  className = '',
}: LoadingProps) {
  const content = (
    <div
      className={`loading loading--${size} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading__spinner" aria-hidden="true">
        <div className="loading__spinner-circle"></div>
      </div>
      {text && <span className="loading__text">{text}</span>}
      {/* 屏幕阅读器专用文本 */}
      <span className="sr-only">{text || '正在加载'}</span>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="loading__overlay" aria-modal="true">
        {content}
      </div>
    );
  }

  return content;
}

export default Loading;
