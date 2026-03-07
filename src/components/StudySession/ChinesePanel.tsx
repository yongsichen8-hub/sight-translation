/**
 * ChinesePanel 组件
 * 左栏中文原文面板，独立滚动
 */

import React from 'react';

interface ChinesePanelProps {
  title: string;
  content: string;
}

export function ChinesePanel({ title, content }: ChinesePanelProps): React.ReactElement {
  return (
    <div className="chinese-panel">
      <div className="chinese-panel__header">
        <span className="chinese-panel__label">中文原文</span>
      </div>
      <h2 className="chinese-panel__title">{title}</h2>
      <div className="chinese-panel__content">
        {content.split('\n').map((paragraph, index) => (
          paragraph.trim() ? (
            <p key={index} className="chinese-panel__paragraph">{paragraph}</p>
          ) : null
        ))}
      </div>
    </div>
  );
}
