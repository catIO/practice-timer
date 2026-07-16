import { describe, it, expect } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
    it('formats zero seconds', () => {
        expect(formatTime(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
        expect(formatTime(5)).toBe('00:05');
        expect(formatTime(59)).toBe('00:59');
    });

    it('formats minutes and seconds', () => {
        expect(formatTime(60)).toBe('01:00');
        expect(formatTime(90)).toBe('01:30');
        expect(formatTime(600)).toBe('10:00');
    });

    it('formats large values', () => {
        expect(formatTime(3599)).toBe('59:59');
        expect(formatTime(3600)).toBe('60:00');
    });

    it('pads single-digit values', () => {
        expect(formatTime(61)).toBe('01:01');
        expect(formatTime(9)).toBe('00:09');
    });
});
