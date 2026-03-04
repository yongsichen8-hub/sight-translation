/**
 * Loading 组件测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, LoadingSize } from './Loading';

describe('Loading', () => {
  it('should render with default text', () => {
    render(<Loading />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should render with custom text', () => {
    render(<Loading text="正在处理..." />);
    expect(screen.getByText('正在处理...')).toBeInTheDocument();
  });

  it('should render without text when text is empty', () => {
    render(<Loading text="" />);
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });

  it.each<LoadingSize>(['small', 'medium', 'large'])(
    'should render %s size correctly',
    (size) => {
      render(<Loading size={size} />);
      const loading = screen.getByRole('status');
      expect(loading).toHaveClass(`loading--${size}`);
    }
  );

  it('should render fullscreen overlay when fullscreen is true', () => {
    const { container } = render(<Loading fullscreen />);
    expect(container.querySelector('.loading__overlay')).toBeInTheDocument();
  });

  it('should not render fullscreen overlay by default', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.loading__overlay')).not.toBeInTheDocument();
  });

  it('should have correct accessibility attributes', () => {
    render(<Loading />);
    const loading = screen.getByRole('status');
    expect(loading).toHaveAttribute('aria-live', 'polite');
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });

  it('should have screen reader text', () => {
    render(<Loading text="加载中..." />);
    const srText = screen.getByText('加载中...', { selector: '.sr-only' });
    expect(srText).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Loading className="custom-class" />);
    const loading = screen.getByRole('status');
    expect(loading).toHaveClass('custom-class');
  });
});
