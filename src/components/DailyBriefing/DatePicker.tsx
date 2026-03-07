/**
 * DatePicker 组件
 * 简单的日期选择器，允许用户切换查看不同日期的简报
 */

import React from 'react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps): React.ReactElement {
  return (
    <input
      type="date"
      className="daily-briefing__date-picker"
      value={value}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) => onChange(e.target.value)}
      aria-label="选择日期"
    />
  );
}

export default DatePicker;
