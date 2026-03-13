/**
 * MemoEditor 组件
 * 基于 Tiptap 的富文本备忘录编辑器
 * 支持标题、加粗、斜体、下划线、文字颜色、链接、图片
 * 内容变更 2 秒防抖自动保存，保存失败显示提示并 10 秒后重试
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import type { MemoContent } from '../../services/ApiClient';
import { ImageLightbox } from './ImageLightbox';
import './MemoEditor.css';

interface MemoEditorProps {
  content: MemoContent;
  onSave: (content: MemoContent) => Promise<void>;
  disabled?: boolean;
}

export function MemoEditor({ content, onSave, disabled = false }: MemoEditorProps) {
  const [saveError, setSaveError] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<MemoContent>(content);

  const doSave = useCallback(async (doc: MemoContent) => {
    try {
      await onSave(doc);
      setSaveError(false);
    } catch {
      setSaveError(true);
      // 10 秒后自动重试
      retryRef.current = setTimeout(() => {
        doSave(latestContentRef.current);
      }, 10000);
    }
  }, [onSave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image.configure({ inline: false }),
      Underline,
      TextStyle,
      Color,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as MemoContent;
      latestContentRef.current = doc;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);

      debounceRef.current = setTimeout(() => {
        doSave(doc);
      }, 2000);
    },
  });

  // 同步 disabled 状态
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  // 添加链接
  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('请输入链接地址');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // 添加图片（URL 或文件上传转 Base64）
  const addImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  // 处理粘贴图片
  useEffect(() => {
    if (!editor) return;
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            editor.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    const el = editor.view.dom;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [editor]);

  // 处理编辑器中图片点击放大
  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      setLightboxSrc((target as HTMLImageElement).src);
    }
  }, []);

  if (!editor) return null;

  return (
    <div className="memo-editor">
      {saveError && (
        <div className="memo-editor__error-banner" role="alert">
          保存失败，请检查网络连接
        </div>
      )}

      <Toolbar editor={editor} disabled={disabled} onAddLink={addLink} onAddImage={addImage} />

      <div className="memo-editor__content" onClick={handleEditorClick}>
        <EditorContent editor={editor} />
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}

/* ---- 工具栏子组件 ---- */

import type { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor;
  disabled: boolean;
  onAddLink: () => void;
  onAddImage: () => void;
}

function Toolbar({ editor, disabled, onAddLink, onAddImage }: ToolbarProps) {
  const btn = (
    label: string,
    isActive: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      className={`memo-editor__toolbar-btn ${isActive ? 'memo-editor__toolbar-btn--active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {label}
    </button>
  );

  return (
    <div className="memo-editor__toolbar" role="toolbar" aria-label="格式化工具栏">
      {/* 标题 */}
      <div className="memo-editor__toolbar-group">
        {btn('H1', editor.isActive('heading', { level: 1 }), () =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        )}
        {btn('H2', editor.isActive('heading', { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        )}
        {btn('H3', editor.isActive('heading', { level: 3 }), () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        )}
      </div>

      {/* 文字格式 */}
      <div className="memo-editor__toolbar-group">
        {btn('B', editor.isActive('bold'), () =>
          editor.chain().focus().toggleBold().run()
        )}
        {btn('I', editor.isActive('italic'), () =>
          editor.chain().focus().toggleItalic().run()
        )}
        {btn('U', editor.isActive('underline'), () =>
          editor.chain().focus().toggleUnderline().run()
        )}
      </div>

      {/* 颜色 */}
      <div className="memo-editor__toolbar-group">
        <input
          type="color"
          className="memo-editor__color-input"
          title="文字颜色"
          disabled={disabled}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          defaultValue="#000000"
        />
      </div>

      {/* 链接和图片 */}
      <div className="memo-editor__toolbar-group">
        {btn('🔗', editor.isActive('link'), onAddLink)}
        {btn('🖼️', false, onAddImage)}
      </div>
    </div>
  );
}

export default MemoEditor;
