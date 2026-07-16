import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timer from './Timer';

describe('Timer component', () => {
    it('renders formatted time', () => {
        render(
            <Timer timeRemaining={125} totalTime={1200} mode="work" isRunning={false} />
        );
        expect(screen.getByText('02:05')).toBeInTheDocument();
    });

    it('renders zero time', () => {
        render(
            <Timer timeRemaining={0} totalTime={1200} mode="work" isRunning={false} />
        );
        expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('applies work mode stroke color', () => {
        const { container } = render(
            <Timer timeRemaining={600} totalTime={1200} mode="work" isRunning={true} />
        );
        const progressCircle = container.querySelectorAll('circle')[1];
        expect(progressCircle.className.baseVal).toContain('stroke-red-500');
    });

    it('applies break mode stroke color', () => {
        const { container } = render(
            <Timer timeRemaining={300} totalTime={300} mode="break" isRunning={true} />
        );
        const progressCircle = container.querySelectorAll('circle')[1];
        expect(progressCircle.className.baseVal).toContain('stroke-green-500');
    });

    it('calculates progress correctly at 50%', () => {
        const { container } = render(
            <Timer timeRemaining={600} totalTime={1200} mode="work" isRunning={false} />
        );
        const progressCircle = container.querySelectorAll('circle')[1];
        // At 50% elapsed: offset should be half of circumference
        const size = 280;
        const strokeWidth = 25;
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const expectedOffset = circumference - (50 / 100) * circumference;
        expect(progressCircle.getAttribute('stroke-dashoffset')).toBe(String(expectedOffset));
    });

    it('shows 0% progress at start (full time remaining)', () => {
        const { container } = render(
            <Timer timeRemaining={1200} totalTime={1200} mode="work" isRunning={false} />
        );
        const progressCircle = container.querySelectorAll('circle')[1];
        const size = 280;
        const strokeWidth = 25;
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        // 0% progress means full offset (no arc visible)
        expect(progressCircle.getAttribute('stroke-dashoffset')).toBe(String(circumference));
    });
});
