import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgentStatusIndicator from '../AgentStatusIndicator';

describe('AgentStatusIndicator', () => {
  it('renders the status panel in the viewport instead of inside the clipped header container', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1913 });
    render(<AgentStatusIndicator onOpenAutonomousAgents={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /Agents:/i });
    trigger.getBoundingClientRect = vi.fn(() => ({
      bottom: 46,
      height: 36,
      left: 312,
      right: 348,
      top: 10,
      width: 36,
      x: 312,
      y: 10,
      toJSON: () => ({})
    }));

    fireEvent.click(trigger);

    const popover = screen.getByRole('dialog', { name: 'Autonomous agent status' });
    expect(popover.parentElement).toBe(document.body);
    expect(popover).toHaveClass('fixed', 'z-[200]');
    expect(popover).toHaveStyle({ left: '312px', top: '54px', width: '360px' });
  });

  it('keeps the panel inside a narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    render(<AgentStatusIndicator onOpenAutonomousAgents={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /Agents:/i });
    trigger.getBoundingClientRect = vi.fn(() => ({
      bottom: 46,
      height: 36,
      left: 275,
      right: 311,
      top: 10,
      width: 36,
      x: 275,
      y: 10,
      toJSON: () => ({})
    }));

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Autonomous agent status' })).toHaveStyle({
      left: '16px',
      width: '288px'
    });
  });
});
