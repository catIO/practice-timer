import { describe, it, expect, vi } from 'vitest';
import { getSubdomain, isRepertoireSubdomain } from './subdomain';

describe('subdomain', () => {
    const originalLocation = window.location;

    function mockHostname(hostname: string) {
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, hostname },
            writable: true,
        });
    }

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
        });
    });

    describe('getSubdomain', () => {
        it('returns "repertoire" for repertoire subdomain', () => {
            mockHostname('repertoire.practice-mate.app');
            expect(getSubdomain()).toBe('repertoire');
        });

        it('returns "timer" for main domain', () => {
            mockHostname('practice-mate.app');
            expect(getSubdomain()).toBe('timer');
        });

        it('returns "timer" for localhost', () => {
            mockHostname('localhost');
            expect(getSubdomain()).toBe('timer');
        });

        it('returns "timer" for timer subdomain', () => {
            mockHostname('timer.practice-mate.app');
            expect(getSubdomain()).toBe('timer');
        });
    });

    describe('isRepertoireSubdomain', () => {
        it('returns true for repertoire subdomain', () => {
            mockHostname('repertoire.practice-mate.app');
            expect(isRepertoireSubdomain()).toBe(true);
        });

        it('returns false for main domain', () => {
            mockHostname('practice-mate.app');
            expect(isRepertoireSubdomain()).toBe(false);
        });
    });
});
