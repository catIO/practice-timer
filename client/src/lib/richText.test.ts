import { describe, it, expect } from 'vitest';
import { applyTextFormat, stripMarkdownLinks } from './richText';

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

describe('stripMarkdownLinks', () => {
    it('returns empty string for null or undefined or empty', () => {
        expect(stripMarkdownLinks(null)).toBe('');
        expect(stripMarkdownLinks(undefined)).toBe('');
        expect(stripMarkdownLinks('')).toBe('');
    });

    it('returns plain text unmodified', () => {
        expect(stripMarkdownLinks('Standard Title')).toBe('Standard Title');
    });

    it('strips markdown link syntax leaving only the label', () => {
        const input = '[Assad Sketches 1.1 - 1.3](https://score.practice-mate.app/?driveId=1OFR9TB-1rgEo1cDKKpdoBhvwlsnzpz7_&name=Sergio%20Assad%2010%20Sketches)';
        expect(stripMarkdownLinks(input)).toBe('Assad Sketches 1.1 - 1.3');
    });

    it('strips markdown links that contain parentheses inside label', () => {
        const input = '[Piece (No. 1)](https://example.com)';
        expect(stripMarkdownLinks(input)).toBe('Piece (No. 1)');
    });

    it('handles multiple markdown links in text', () => {
        const input = 'Study [Etude 1](https://example.com/1) and [Etude 2](https://example.com/2)';
        expect(stripMarkdownLinks(input)).toBe('Study Etude 1 and Etude 2');
    });
});

