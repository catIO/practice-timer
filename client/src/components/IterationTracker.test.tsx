import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IterationTracker from './IterationTracker';

describe('IterationTracker', () => {
    it('displays current iteration and total', () => {
        render(
            <IterationTracker currentIteration={3} totalIterations={6} mode="work" />
        );
        expect(screen.getByText(/3 of 6/)).toBeInTheDocument();
    });

    it('shows "Work Session" label in work mode', () => {
        render(
            <IterationTracker currentIteration={1} totalIterations={4} mode="work" />
        );
        expect(screen.getByText(/Work Session/)).toBeInTheDocument();
    });

    it('shows "Break" label in break mode', () => {
        render(
            <IterationTracker currentIteration={2} totalIterations={4} mode="break" />
        );
        expect(screen.getByText(/Break/)).toBeInTheDocument();
    });

    it('renders correct number of dots', () => {
        const { container } = render(
            <IterationTracker currentIteration={2} totalIterations={5} mode="work" />
        );
        const dots = container.querySelectorAll('.rounded-full');
        expect(dots).toHaveLength(5);
    });
});
