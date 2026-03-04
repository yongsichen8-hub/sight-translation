/**
 * Button 组件测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, ButtonVariant, ButtonSize } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>点击我</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>点击我</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should not call onClick when loading', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} loading>点击我</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each<ButtonVariant>(['primary', 'secondary', 'danger', 'ghost'])(
    'should render %s variant correctly',
    (variant) => {
      render(<Button variant={variant}>按钮</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass(`button--${variant}`);
    }
  );

  it.each<ButtonSize>(['small', 'medium', 'large'])(
    'should render %s size correctly',
    (size) => {
      render(<Button size={size}>按钮</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass(`button--${size}`);
    }
  );

  it('should render full width when fullWidth is true', () => {
    render(<Button fullWidth>按钮</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--full-width');
  });

  it('should show loading spinner when loading', () => {
    const { container } = render(<Button loading>按钮</Button>);
    expect(container.querySelector('.button__spinner')).toBeInTheDocument();
  });

  it('should have correct accessibility attributes when loading', () => {
    render(<Button loading>按钮</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('should have correct accessibility attributes when disabled', () => {
    render(<Button disabled>按钮</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeDisabled();
  });

  it('should apply custom className', () => {
    render(<Button className="custom-class">按钮</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should pass through other button attributes', () => {
    render(<Button type="submit" name="test-button">提交</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'test-button');
  });
});
