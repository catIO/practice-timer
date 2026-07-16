import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimerDisplay } from './TimerDisplay';

describe('TimerDisplay', () => {
    it('displays formatted time correctly', () => {
        render(<TimerDisplay timeRemaining={125} totalTime={1200} mode="work" />);
        expect(screen.getByText('02:05')).toBeInTheDocument();
    });

    it('shows "Work Time" label during work mode', () => {
        render(<TimerDisplay timeRemaining={600} totalTime={1200} mode="work" />);
        expect(screen.getByText('Work Time')).toBeInTheDocument();
    });

    it('shows "Break Time" label during break mode', () => {
        render(<TimerDisplay timeRemaining={300} totalTime={300} mode="break" />);
        expect(screen.getByText('Break Time')).toBeInTheDocument();
    });

    it('applies work mode color', () => {
        const { container } = render(
            <TimerDisplay timeRemaining={600} totalTime={1200} mode="work" />
        );
        const circles = container.querySelectorAll('circle');
        const progressCircle = circles[1];
        expect(progressCircle.className.baseVal).toContain('text-blue-500');
    });

    it('applies break mode color', () => {
        const { container } = render(
            <TimerDisplay timeRemaining={300} totalTime={300} mode="break" />
        );
        const circles = container.querySelectorAll('circle');
        const progressCircle = circles[1];
        expect(progressCircle.className.baseVal).toContain('text-green-500');
    });

    it('renders zero time', () => {
        render(<TimerDisplay timeRemaining={0} totalTime={1200} mode="work" />);
        expect(screen.getByText('00:00')).toBeInTheDocument();
    });
});
