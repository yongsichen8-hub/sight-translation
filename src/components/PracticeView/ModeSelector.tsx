/**
 * ModeSelector 组件
 * 练习模式选择器，支持中译英/英译中切换
 */

import React from 'react';
import type { PracticeMode } from '../../context/AppContext';

/**
 * ModeSelector Props 接口
 */
export interface ModeSelectorProps {
  /** 当前模式 */
  mode: PracticeMode;
  /** 模式变更回调 */
  onModeChange: (mode: PracticeMode) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * ModeSelector 组件
 * 提供中译英和英译中两种练习模式的切换
 */
export function ModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="mode-selector" role="group" aria-label="练习模式选择">
      <button
        type="button"
        className={`mode-selector__button ${
          mode === 'zh-to-en' ? 'mode-selector__button--active' : ''
        }`}
        onClick={() => onModeChange('zh-to-en')}
        disabled={disabled}
        aria-pressed={mode === 'zh-to-en'}
      >
        中译英
      </button>
      <button
        type="button"
        className={`mode-selector__button ${
          mode === 'en-to-zh' ? 'mode-selector__button--active' : ''
        }`}
        onClick={() => onModeChange('en-to-zh')}
        disabled={disabled}
        aria-pressed={mode === 'en-to-zh'}
      >
        英译中
      </button>
    </div>
  );
}

export default ModeSelector;
