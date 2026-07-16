import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type SettingsType } from './timerService';

describe('timerService', () => {
    describe('DEFAULT_SETTINGS', () => {
        it('has correct default work duration', () => {
            expect(DEFAULT_SETTINGS.workDuration).toBe(20);
        });

        it('has correct default break duration', () => {
            expect(DEFAULT_SETTINGS.breakDuration).toBe(5);
        });

        it('has correct default iterations', () => {
            expect(DEFAULT_SETTINGS.iterations).toBe(6);
        });

        it('has sound enabled by default', () => {
            expect(DEFAULT_SETTINGS.soundEnabled).toBe(true);
        });

        it('has browser notifications disabled by default', () => {
            expect(DEFAULT_SETTINGS.browserNotificationsEnabled).toBe(false);
        });

        it('has correct default volume', () => {
            expect(DEFAULT_SETTINGS.volume).toBe(50);
        });

        it('has correct default sound type', () => {
            expect(DEFAULT_SETTINGS.soundType).toBe('singing-bowl');
        });

        it('has week starting on monday by default', () => {
            expect(DEFAULT_SETTINGS.weekStartsOn).toBe('monday');
        });

        it('has dark theme by default', () => {
            expect(DEFAULT_SETTINGS.theme).toBe('dark');
        });

        it('has all required fields', () => {
            const requiredFields: (keyof SettingsType)[] = [
                'workDuration', 'breakDuration', 'iterations',
                'soundEnabled', 'browserNotificationsEnabled',
                'numberOfBeeps', 'mode', 'volume', 'soundType', 'weekStartsOn'
            ];
            for (const field of requiredFields) {
                expect(DEFAULT_SETTINGS[field]).toBeDefined();
            }
        });
    });
});
