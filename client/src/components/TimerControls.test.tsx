import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimerControls from './TimerControls';

describe('TimerControls', () => {
    const defaultProps = {
        isRunning: false,
        onStart: vi.fn(),
        onPause: vi.fn(),
        onReset: vi.fn(),
        onSkip: vi.fn(),
    };

    it('shows play button when not running', () => {
        render(<TimerControls {...defaultProps} />);
        expect(screen.getByLabelText('Start timer')).toBeInTheDocument();
    });

    it('shows pause button when running', () => {
        render(<TimerControls {...defaultProps} isRunning={true} />);
        expect(screen.getByLabelText('Pause timer')).toBeInTheDocument();
    });

    it('calls onStart when play is clicked', () => {
        const onStart = vi.fn();
        render(<TimerControls {...defaultProps} onStart={onStart} />);
        fireEvent.click(screen.getByLabelText('Start timer'));
        expect(onStart).toHaveBeenCalledOnce();
    });

    it('calls onPause when pause is clicked', () => {
        const onPause = vi.fn();
        render(<TimerControls {...defaultProps} isRunning={true} onPause={onPause} />);
        fireEvent.click(screen.getByLabelText('Pause timer'));
        expect(onPause).toHaveBeenCalledOnce();
    });

    it('calls onReset when reset is clicked', () => {
        const onReset = vi.fn();
        render(<TimerControls {...defaultProps} onReset={onReset} />);
        fireEvent.click(screen.getByLabelText('Reset timer to beginning'));
        expect(onReset).toHaveBeenCalledOnce();
    });

    it('calls onSkip when skip is clicked', () => {
        const onSkip = vi.fn();
        render(<TimerControls {...defaultProps} onSkip={onSkip} />);
        fireEvent.click(screen.getByLabelText('Skip to next phase'));
        expect(onSkip).toHaveBeenCalledOnce();
    });

    it('disables skip button when skipDisabled is true', () => {
        render(<TimerControls {...defaultProps} skipDisabled={true} />);
        expect(screen.getByLabelText('Skip to next phase')).toBeDisabled();
    });
});
