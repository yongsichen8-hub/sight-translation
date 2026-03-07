/**
 * SourceBadge 组件
 * 展示媒体名称和信誉等级标识（T1/T2）
 */

import React from 'react';

export interface SourceBadgeProps {
  sourceName: string;
  tier?: 'T1' | 'T2';
}

const tierStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '0.65rem',
  fontWeight: 600,
  marginLeft: '0.375rem',
};

const tierColors: Record<'T1' | 'T2', React.CSSProperties> = {
  T1: { background: '#dbeafe', color: '#1d4ed8' },
  T2: { background: '#e0e7ff', color: '#4338ca' },
};

export function SourceBadge({ sourceName, tier }: SourceBadgeProps): React.ReactElement {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.8rem' }}>
      <span style={{ fontWeight: 500, color: '#374151' }}>{sourceName}</span>
      {tier && (
        <span style={{ ...tierStyle, ...tierColors[tier] }}>{tier}</span>
      )}
    </span>
  );
}

export default SourceBadge;
