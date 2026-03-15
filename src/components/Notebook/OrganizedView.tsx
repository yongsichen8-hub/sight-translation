/**
 * OrganizedView 组件
 * 展示 AI 整理后的 Markdown 内容，URL 链接可点击，图片可点击放大
 */

import { useState, useCallback } from 'react';
import type { OrganizedResult, MemoContent, TiptapNode } from '../../services/ApiClient';
import { Loading } from '../common';
import { ImageLightbox } from './ImageLightbox';

interface OrganizedViewProps {
  result: OrganizedResult | null;
  loading: boolean;
  memoContent?: MemoContent | null;
}

/**
 * 从 MemoContent 中提取所有图片 URL（按出现顺序）
 */
function extractImageUrls(content: MemoContent | null | undefined): string[] {
  if (!content?.content) return [];
  const urls: string[] = [];
  const walk = (nodes: TiptapNode[] | undefined): void => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'image' && node.attrs?.src) {
        urls.push(node.attrs.src as string);
      }
      walk(node.content);
    }
  };
  walk(content.content);
  return urls;
}

/**
 * 将 markdown 中的 placeholder://N 替换为真实图片 URL
 */
function resolvePlaceholders(markdown: string, imageUrls: string[]): string {
  return markdown.replace(/!\[([^\]]*)\]\(placeholder:\/\/(\d+)\)/g, (_match, alt, idxStr) => {
    const idx = parseInt(idxStr, 10) - 1;
    if (idx >= 0 && idx < imageUrls.length) {
      return `![${alt}](${imageUrls[idx]})`;
    }
    return _match;
  });
}

/**
 * 简易 Markdown → HTML 转换
 * 支持：## 标题、**加粗**、*斜体*、[链接](url)、![图片](url)、裸 URL、换行
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
      // 纯图片行
      const imgOnlyMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgOnlyMatch) {
        const alt = escapeHtml(imgOnlyMatch[1] || '');
        const src = imgOnlyMatch[2] || '';
        return `<p><img src="${src}" alt="${alt}" class="organized-view__image" data-lightbox="true" /></p>`;
      }
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
  // Markdown 图片 ![alt](url) — 内联图片
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="organized-view__image" data-lightbox="true" />'
  );
  // Markdown 链接 [text](url)
  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // 裸 URL（未被 <a> 或 <img> 包裹的）
  result = result.replace(
    /(?<!href="|">|src=")(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // 加粗 **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
}

export function OrganizedView({ result, loading, memoContent }: OrganizedViewProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.dataset.lightbox === 'true') {
      setLightboxSrc((target as HTMLImageElement).src);
    }
  }, []);

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

  const imageUrls = extractImageUrls(memoContent);
  const resolvedMarkdown = resolvePlaceholders(result.markdown, imageUrls);
  const html = markdownToHtml(resolvedMarkdown);

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
        onClick={handleContentClick}
      />
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}

export default OrganizedView;
