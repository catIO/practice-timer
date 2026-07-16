import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeComplete from './PracticeComplete';

describe('PracticeComplete', () => {
    const defaultProps = {
        currentIteration: 6,
        totalIterations: 6,
        onStartNewSession: vi.fn(),
    };

    it('shows completion message', () => {
        render(<PracticeComplete {...defaultProps} />);
        expect(screen.getByText('Practice Complete!')).toBeInTheDocument();
    });

    it('shows total sessions completed', () => {
        render(<PracticeComplete {...defaultProps} />);
        expect(screen.getByText(/6 of 6 sessions completed/)).toBeInTheDocument();
    });

    it('shows session count in description', () => {
        render(<PracticeComplete {...defaultProps} totalIterations={4} />);
        expect(screen.getByText(/all 4 work sessions/)).toBeInTheDocument();
    });

    it('calls onStartNewSession when button is clicked', () => {
        const onStartNewSession = vi.fn();
        render(<PracticeComplete {...defaultProps} onStartNewSession={onStartNewSession} />);
        fireEvent.click(screen.getByText('Start New Session'));
        expect(onStartNewSession).toHaveBeenCalledOnce();
    });
});
