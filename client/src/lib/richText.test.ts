import { describe, it, expect } from 'vitest';
import { applyTextFormat } from './richText';

describe('applyTextFormat', () => {
    const text = 'Hello world example text';

    describe('bold', () => {
        it('wraps selected text in **', () => {
            const result = applyTextFormat(text, { start: 6, end: 11 }, 'bold');
            expect(result).not.toBeNull();
            expect(result!.newText).toBe('Hello **world** example text');
            expect(result!.newCursorEnd).toBe(6 + 5 + 4); // start + "world".length + 4 asterisks
        });

        it('returns null when no selection', () => {
            const result = applyTextFormat(text, { start: 5, end: 5 }, 'bold');
            expect(result).toBeNull();
        });
    });

    describe('italic', () => {
        it('wraps selected text in *', () => {
            const result = applyTextFormat(text, { start: 6, end: 11 }, 'italic');
            expect(result).not.toBeNull();
            expect(result!.newText).toBe('Hello *world* example text');
            expect(result!.newCursorEnd).toBe(6 + 5 + 2);
        });
    });

    describe('link', () => {
        it('wraps selected text in markdown link syntax', () => {
            const result = applyTextFormat(text, { start: 6, end: 11 }, 'link', 'https://example.com');
            expect(result).not.toBeNull();
            expect(result!.newText).toBe('Hello [world](https://example.com) example text');
        });

        it('returns null when no URL provided', () => {
            const result = applyTextFormat(text, { start: 6, end: 11 }, 'link');
            expect(result).toBeNull();
        });

        it('uses custom linkText option', () => {
            const result = applyTextFormat(text, { start: 6, end: 11 }, 'link', 'https://example.com', { linkText: 'custom' });
            expect(result).not.toBeNull();
            expect(result!.newText).toBe('Hello [custom](https://example.com) example text');
        });
    });
});
