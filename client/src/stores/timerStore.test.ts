import { describe, it, expect, beforeEach, vi } from 'vitest';

// Capture the worker mock so tests can assert on postMessage and simulate
// worker-to-store messages (e.g. PIECE_TICK during segment overtime).
const workerMock = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};
// Captured by the mocked addMessageHandler so tests can drive the store as if
// the worker were sending messages.
let capturedMessageHandler: ((event: MessageEvent) => void) | null = null;

// Mock the worker singleton before importing the store
vi.mock('@/lib/timerWorkerSingleton', () => ({
    getTimerWorker: vi.fn(() => Promise.resolve(workerMock)),
    addMessageHandler: vi.fn((handler: (event: MessageEvent) => void) => {
        capturedMessageHandler = handler;
    }),
    removeMessageHandler: vi.fn(),
}));

vi.mock('@/lib/practiceLog', () => ({
    addPracticeTime: vi.fn(),
    addDetailedPracticeTime: vi.fn(),
    getPiecePracticedSeconds: vi.fn(() => 0),
    logSegmentCompletion: vi.fn(),
}));

vi.mock('@/lib/practicePlan', () => ({
    getPracticePlan: vi.fn(() => []),
    practicePlanApi: {
        getSegmentItems: vi.fn(() => []),
        checkItem: vi.fn((plan: unknown) => plan),
    },
}));

vi.mock('@/lib/userDataSync', () => ({
    scheduleUserDataPush: vi.fn(),
}));

import { useTimerStore } from './timerStore';
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import { addDetailedPracticeTime } from '@/lib/practiceLog';

// Simulate a PIECE_TICK message coming from the worker.
function emitPieceTick() {
    if (!capturedMessageHandler) {
        throw new Error('Worker message handler was not captured — did you call initializeWorker() first?');
    }
    capturedMessageHandler({ data: { type: 'PIECE_TICK' } } as MessageEvent);
}

describe('timerStore', () => {
    beforeEach(() => {
        // Reset worker mock between tests so postMessage assertions are isolated
        // and the message handler capture doesn't leak.
        workerMock.postMessage.mockClear();
        workerMock.terminate.mockClear();
        capturedMessageHandler = null;

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

    it('setSettings updates settings and recalculates time in work mode', () => {
        const newSettings = { ...DEFAULT_SETTINGS, workDuration: 30 };
        useTimerStore.getState().setSettings(newSettings);
        const state = useTimerStore.getState();
        expect(state.settings.workDuration).toBe(30);
        expect(state.timeRemaining).toBe(30 * 60);
        expect(state.totalTime).toBe(30 * 60);
    });

    it('setSettings updates settings and recalculates time in break mode', () => {
        useTimerStore.setState({
            mode: 'break',
            timeRemaining: 5 * 60,
            totalTime: 5 * 60,
        });

        const newSettings = { ...DEFAULT_SETTINGS, breakDuration: 1 };
        useTimerStore.getState().setSettings(newSettings);
        const state = useTimerStore.getState();
        expect(state.settings.breakDuration).toBe(1);
        expect(state.mode).toBe('break');
        expect(state.timeRemaining).toBe(60);
        expect(state.totalTime).toBe(60);
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

    it('selectPiece initializes target time box duration', () => {
        useTimerStore.getState().selectPiece('piece-1', 'Bach Prelude', 10, 'day');
        const state = useTimerStore.getState();
        expect(state.activePieceId).toBe('piece-1');
        expect(state.activePieceName).toBe('Bach Prelude');
        expect(state.pieceTimeRemaining).toBe(600);
        expect(state.pieceTotalTime).toBe(600);
    });

    it('startPieceOvertime starts overtime count and logs time', async () => {
        // Initialize worker so the store attaches its message handler (which
        // we intercept via the mocked addMessageHandler).
        await useTimerStore.getState().initializeWorker();
        expect(capturedMessageHandler).toBeTruthy();

        useTimerStore.setState({
            // Mode must be 'break' (or isPracticeComplete true) for the shadow
            // `set` in the store to keep pieceOvertimeRunning=true — the store
            // derives isPieceOvertime from (mode==='break' || isPracticeComplete)
            // && activePieceId, and forces pieceOvertimeRunning=false whenever
            // isPieceOvertime is false. In real usage, overtime only starts
            // after the main work session ends.
            mode: 'break',
            activePieceId: 'piece-1',
            activePieceName: 'Bach Prelude',
            pieceTimeRemaining: 10,
            pieceTotalTime: 10,
            isPieceOvertime: true,
            isPiecePaused: false,
        });

        await useTimerStore.getState().startPieceOvertime();
        expect(useTimerStore.getState().pieceOvertimeRunning).toBe(true);
        // Store should have asked the worker to start ticking.
        expect(workerMock.postMessage).toHaveBeenCalledWith({ type: 'PIECE_TICK_START' });

        // Simulate 3 worker-driven ticks (1s each).
        emitPieceTick();
        emitPieceTick();
        emitPieceTick();

        expect(useTimerStore.getState().pieceTimeRemaining).toBe(7);
        expect(addDetailedPracticeTime).toHaveBeenCalledWith('piece-1', 'Bach Prelude', 1);

        // Stop overtime
        useTimerStore.getState().stopPieceOvertime();
        expect(useTimerStore.getState().pieceOvertimeRunning).toBe(false);
        expect(workerMock.postMessage).toHaveBeenCalledWith({ type: 'PIECE_TICK_STOP' });
    });

    it('skipTimer updates mode and timeRemaining atomically from work to break', async () => {
        useTimerStore.setState({
            mode: 'work',
            timeRemaining: 1500,
            totalTime: 1500,
            currentIteration: 1,
            totalIterations: 4,
            settings: DEFAULT_SETTINGS,
            isSkipping: false
        });

        await useTimerStore.getState().skipTimer();

        const state = useTimerStore.getState();
        expect(state.mode).toBe('break');
        expect(state.timeRemaining).toBe(DEFAULT_SETTINGS.breakDuration * 60);
        expect(state.totalTime).toBe(DEFAULT_SETTINGS.breakDuration * 60);
    });

    it('skipTimer updates mode and timeRemaining atomically from break to work', async () => {
        useTimerStore.setState({
            mode: 'break',
            timeRemaining: 300,
            totalTime: 300,
            currentIteration: 1,
            totalIterations: 4,
            settings: DEFAULT_SETTINGS,
            isSkipping: false
        });

        await useTimerStore.getState().skipTimer();

        const state = useTimerStore.getState();
        expect(state.mode).toBe('work');
        expect(state.timeRemaining).toBe(DEFAULT_SETTINGS.workDuration * 60);
        expect(state.totalTime).toBe(DEFAULT_SETTINGS.workDuration * 60);
        expect(state.currentIteration).toBe(2);
    });

    it('startTimer corrects desynchronized mode when timeRemaining exceeds break duration', async () => {
        useTimerStore.setState({
            mode: 'break',
            timeRemaining: 1500, // 25 minutes work duration
            totalTime: 1500,
            settings: DEFAULT_SETTINGS
        });

        await useTimerStore.getState().startTimer();

        const state = useTimerStore.getState();
        expect(state.mode).toBe('work');
    });
});
