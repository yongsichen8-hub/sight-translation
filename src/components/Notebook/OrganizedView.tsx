/**
 * OrganizedView 组件
 * 展示 AI 整理后的 Markdown 内容，URL 链接可点击
 */

import type { OrganizedResult } from '../../services/ApiClient';
import { Loading } from '../common';

interface OrganizedViewProps {
  result: OrganizedResult | null;
  loading: boolean;
}

/**
 * 简易 Markdown → HTML 转换
 * 支持：## 标题、**加粗**、*斜体*、[链接](url)、裸 URL、换行
 */
function markdownToHtml(md: string): string {
  return md
    .split('\n')
    .map(line => {
      // 标题
      if (line.startsWith('### ')) return `<h3>${escapeAndFormat(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${escapeAndFormat(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${escapeAndFormat(line.slice(2))}</h1>`;
      // 空行
      if (line.trim() === '') return '<br/>';
      // 列表项
      if (line.match(/^\s*[-*]\s/)) {
        return `<li>${escapeAndFormat(line.replace(/^\s*[-*]\s/, ''))}</li>`;
      }
      // 普通段落
      return `<p>${escapeAndFormat(line)}</p>`;
    })
    .join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAndFormat(text: string): string {
  let result = escapeHtml(text);
  // Markdown 链接 [text](url)
  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // 裸 URL（未被 <a> 包裹的）
  result = result.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // 加粗 **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
}

export function OrganizedView({ result, loading }: OrganizedViewProps) {
  if (loading) {
    return (
      <div className="organized-view organized-view--loading">
        <Loading text="AI 正在整理中..." />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="organized-view organized-view--empty">
        <div className="organized-view__placeholder">
          <span className="organized-view__placeholder-icon">📋</span>
          <p>暂无整理结果</p>
          <p className="organized-view__placeholder-hint">点击"一键整理"按钮，AI 将帮你归纳备忘录内容</p>
        </div>
      </div>
    );
  }

  const html = markdownToHtml(result.markdown);

  return (
    <div className="organized-view">
      <div className="organized-view__header">
        <span className="organized-view__title">整理结果</span>
        <span className="organized-view__time">
          {new Date(result.organizedAt).toLocaleString('zh-CN')}
        </span>
      </div>
      <div
        className="organized-view__content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export default OrganizedView;
