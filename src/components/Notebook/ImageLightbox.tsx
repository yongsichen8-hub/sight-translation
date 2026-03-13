/**
 * ImageLightbox 组件
 * 点击图片后全屏放大查看，点击遮罩或按 Esc 关闭
 */

import { useEffect, useCallback } from 'react';
import './ImageLightbox.css';

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="image-lightbox" onClick={onClose} role="dialog" aria-label="图片预览">
      <button className="image-lightbox__close" onClick={onClose} aria-label="关闭预览">✕</button>
      <img
        className="image-lightbox__img"
        src={src}
        alt="放大预览"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

export default ImageLightbox;
