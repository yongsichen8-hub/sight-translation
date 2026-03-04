/**
 * Toast 组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast, ToastType } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render message when visible', () => {
    render(
      <Toast message="测试消息" visible={true} onClose={() => {}} />
    );
    expect(screen.getByText('测试消息')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(
      <Toast message="测试消息" visible={false} onClose={() => {}} />
    );
    expect(screen.queryByText('测试消息')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Toast message="测试消息" visible={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByLabelText('关闭提示'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto close after duration', () => {
    const onClose = vi.fn();
    render(
      <Toast message="测试消息" visible={true} onClose={onClose} duration={3000} />
    );
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not auto close when duration is 0', () => {
    const onClose = vi.fn();
    render(
      <Toast message="测试消息" visible={true} onClose={onClose} duration={0} />
    );
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Toast message="测试消息" visible={true} onClose={onClose} />
    );
    fireEvent.keyDown(screen.getByRole('alert'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each<ToastType>(['success', 'error', 'warning', 'info'])(
    'should render %s type correctly',
    (type) => {
      render(
        <Toast message="测试消息" visible={true} onClose={() => {}} type={type} />
      );
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass(`toast--${type}`);
    }
  );

  it('should have correct accessibility attributes', () => {
    render(
      <Toast message="测试消息" visible={true} onClose={() => {}} />
    );
    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveAttribute('aria-atomic', 'true');
  });

  it('should apply custom className', () => {
    render(
      <Toast message="测试消息" visible={true} onClose={() => {}} className="custom-class" />
    );
    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('custom-class');
  });
});
