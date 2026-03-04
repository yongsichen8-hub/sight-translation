/**
 * Modal 组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    // 重置 body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should render children when visible', () => {
    render(
      <Modal visible={true} onClose={() => {}}>
        <p>模态框内容</p>
      </Modal>
    );
    expect(screen.getByText('模态框内容')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(
      <Modal visible={false} onClose={() => {}}>
        <p>模态框内容</p>
      </Modal>
    );
    expect(screen.queryByText('模态框内容')).not.toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <Modal visible={true} onClose={() => {}} title="测试标题">
        <p>内容</p>
      </Modal>
    );
    expect(screen.getByText('测试标题')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal visible={true} onClose={onClose} title="标题">
        <p>内容</p>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText('关闭对话框'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal visible={true} onClose={onClose}>
        <p>内容</p>
      </Modal>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal visible={true} onClose={onClose}>
        <p>内容</p>
      </Modal>
    );
    const overlay = container.querySelector('.modal__overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal visible={true} onClose={onClose}>
        <p>内容</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose on overlay click when closeOnOverlayClick is false', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal visible={true} onClose={onClose} closeOnOverlayClick={false}>
        <p>内容</p>
      </Modal>
    );
    const overlay = container.querySelector('.modal__overlay');
    fireEvent.click(overlay!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not show close button when showCloseButton is false', () => {
    render(
      <Modal visible={true} onClose={() => {}} showCloseButton={false} title="标题">
        <p>内容</p>
      </Modal>
    );
    expect(screen.queryByLabelText('关闭对话框')).not.toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(
      <Modal visible={true} onClose={() => {}} footer={<button>确定</button>}>
        <p>内容</p>
      </Modal>
    );
    expect(screen.getByText('确定')).toBeInTheDocument();
  });

  it('should have correct accessibility attributes', () => {
    render(
      <Modal visible={true} onClose={() => {}} title="测试标题">
        <p>内容</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('should prevent body scroll when visible', () => {
    render(
      <Modal visible={true} onClose={() => {}}>
        <p>内容</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(
      <Modal visible={true} onClose={() => {}}>
        <p>内容</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(
      <Modal visible={false} onClose={() => {}}>
        <p>内容</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('should apply custom className', () => {
    render(
      <Modal visible={true} onClose={() => {}} className="custom-class">
        <p>内容</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('custom-class');
  });
});
