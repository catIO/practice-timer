import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the worker singleton before importing the store
vi.mock('@/lib/timerWorkerSingleton', () => ({
    getTimerWorker: vi.fn(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })),
    addMessageHandler: vi.fn(),
    removeMessageHandler: vi.fn(),
}));

vi.mock('@/lib/practiceLog', () => ({
    addPracticeTime: vi.fn(),
    addDetailedPracticeTime: vi.fn(),
    getPiecePracticedSeconds: vi.fn(() => 0),
}));

vi.mock('@/lib/practicePlan', () => ({
    getPracticePlan: vi.fn(() => []),
    practicePlanApi: { getSegmentItems: vi.fn(() => []) },
}));

import { useTimerStore } from './timerStore';
import { DEFAULT_SETTINGS } from '@/lib/timerService';

describe('timerStore', () => {
    beforeEach(() => {
        // Reset the store state between tests
        useTimerStore.setState({
            timeRemaining: DEFAULT_SETTINGS.workDuration * 60,
            totalTime: DEFAULT_SETTINGS.workDuration * 60,
            isRunning: false,
            mode: 'work',
            currentIteration: 1,
            totalIterations: DEFAULT_SETTINGS.iterations,
            isPracticeComplete: false,
            isSkipping: false,
            activePieceId: null,
            activePieceName: null,
            pieceTimeRemaining: 0,
            pieceTotalTime: 0,
            isPiecePaused: false,
            isPieceOvertime: false,
            pieceOvertimeRunning: false,
            audioInitialized: false,
            settings: DEFAULT_SETTINGS,
            workerReady: false,
            lastMessageSequence: 0,
        });
    });

    it('has correct initial state', () => {
        const state = useTimerStore.getState();
        expect(state.isRunning).toBe(false);
        expect(state.mode).toBe('work');
        expect(state.currentIteration).toBe(1);
        expect(state.isPracticeComplete).toBe(false);
        expect(state.timeRemaining).toBe(DEFAULT_SETTINGS.workDuration * 60);
    });

    it('setSettings updates settings and recalculates time', () => {
        const newSettings = { ...DEFAULT_SETTINGS, workDuration: 30 };
        useTimerStore.getState().setSettings(newSettings);
        const state = useTimerStore.getState();
        expect(state.settings.workDuration).toBe(30);
    });

    it('setMode updates mode', () => {
        useTimerStore.getState().setMode('break');
        expect(useTimerStore.getState().mode).toBe('break');
    });

    it('setCurrentIteration updates iteration', () => {
        useTimerStore.getState().setCurrentIteration(3);
        expect(useTimerStore.getState().currentIteration).toBe(3);
    });

    it('setIsPracticeComplete updates completion state', () => {
        useTimerStore.getState().setIsPracticeComplete(true);
        expect(useTimerStore.getState().isPracticeComplete).toBe(true);
    });

    it('setActivePiece sets piece info', () => {
        useTimerStore.getState().setActivePiece('piece-1', 'Bach Prelude');
        const state = useTimerStore.getState();
        expect(state.activePieceId).toBe('piece-1');
        expect(state.activePieceName).toBe('Bach Prelude');
    });

    it('clearPiece resets piece state', () => {
        useTimerStore.getState().setActivePiece('piece-1', 'Bach Prelude');
        useTimerStore.getState().clearPiece();
        const state = useTimerStore.getState();
        expect(state.activePieceId).toBeNull();
        expect(state.activePieceName).toBeNull();
    });
});
