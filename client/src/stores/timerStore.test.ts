import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

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

vi.mock('@/lib/soundEffects', () => ({
    playSound: vi.fn().mockResolvedValue(undefined),
    resumeAudioContext: vi.fn().mockResolvedValue(undefined),
    unlockAudioContext: vi.fn(),
    startSilenceKeepAlive: vi.fn(),
    stopSilenceKeepAlive: vi.fn(),
    suspendAudioContext: vi.fn(),
}));

let useTimerStore: typeof import('./timerStore').useTimerStore;
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import { addPracticeTime, addDetailedPracticeTime, logSegmentCompletion } from '@/lib/practiceLog';
import { practicePlanApi } from '@/lib/practicePlan';
import { addMessageHandler, removeMessageHandler } from '@/lib/timerWorkerSingleton';
import { playSound } from '@/lib/soundEffects';

let incomingSequence = 0;

function emitMessage(type: string, payload?: unknown, sequence?: number) {
    if (!capturedMessageHandler) throw new Error('Worker message handler was not captured');
    capturedMessageHandler({ data: { type, payload, sequence } } as MessageEvent);
}

// Worker sequences advance beyond received commands, as in timerWorker.ts.
function emitState(type: string, timeRemaining: number, mode = useTimerStore.getState().mode,
    currentIteration = useTimerStore.getState().currentIteration) {
    const outgoingSequences = workerMock.postMessage.mock.calls.map(([message]) => message.sequence ?? 0);
    incomingSequence = Math.max(incomingSequence, ...outgoingSequences) + 1;
    emitMessage(type, {
        timeRemaining, mode, currentIteration,
        totalIterations: useTimerStore.getState().totalIterations,
    }, incomingSequence);
}

// Simulate a PIECE_TICK message coming from the worker.
function emitPieceTick() {
    if (!capturedMessageHandler) {
        throw new Error('Worker message handler was not captured — did you call initializeWorker() first?');
    }
    capturedMessageHandler({ data: { type: 'PIECE_TICK' } } as MessageEvent);
}

describe('timerStore', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        vi.resetModules();
        vi.clearAllMocks();
        localStorage.clear();
        incomingSequence = 0;
        // Reset worker mock between tests so postMessage assertions are isolated
        // and the message handler capture doesn't leak.
        workerMock.postMessage.mockClear();
        workerMock.terminate.mockClear();
        capturedMessageHandler = null;
        workerMock.postMessage.mockImplementation(({ sequence }) => {
            if (capturedMessageHandler && sequence !== undefined) {
                emitMessage('ACK', undefined, sequence);
            }
        });

        // A fresh module also resets the private worker/pending-message state.
        ({ useTimerStore } = await import('./timerStore'));

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

        // Initialization sends settings before attaching the handler. Exercise
        // its bounded ACK timeout rather than waiting a real second per test.
        const initialization = useTimerStore.getState().initializeWorker();
        await vi.advanceTimersByTimeAsync(1000);
        await initialization;
        expect(capturedMessageHandler).toBeTypeOf('function');
    });

    afterEach(async () => {
        cleanup();
        // Drain the existing skip safety/finally timeouts before resetting the
        // module. Never runAllTimers: the store owns recurring intervals.
        await vi.advanceTimersByTimeAsync(1000);
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        localStorage.clear();
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

    it('handles worker work/break completion and advances the iteration only after break', async () => {
        const timer = useTimerStore.getState();
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1, iterations: 2 });
        await timer.startTimer();
        emitState('TICK', 0);
        expect(addPracticeTime).toHaveBeenCalledExactlyOnceWith(120);
        emitState('PAUSED', 0);
        emitState('COMPLETE', 60, 'break');
        expect(useTimerStore.getState()).toMatchObject({
            mode: 'break', timeRemaining: 60, totalTime: 60,
            currentIteration: 1, totalIterations: 2, isRunning: false,
        });

        await timer.startTimer();
        emitState('TICK', 0);
        emitState('PAUSED', 0);
        emitState('COMPLETE', 120, 'work', 2);
        expect(useTimerStore.getState()).toMatchObject({
            mode: 'work', timeRemaining: 120, totalTime: 120,
            currentIteration: 2, isRunning: false, isPracticeComplete: false,
        });
        expect(addPracticeTime).toHaveBeenCalledTimes(1);

        await timer.startTimer();
        emitState('TICK', 0);
        emitState('PAUSED', 0);
        emitMessage('PRACTICE_COMPLETE', { currentIteration: 2, totalIterations: 2 }, ++incomingSequence);
        expect(useTimerStore.getState()).toMatchObject({
            isRunning: false, isPracticeComplete: true, currentIteration: 2, timeRemaining: 0,
        });
        expect(addPracticeTime).toHaveBeenCalledTimes(2);
    });

    it.each(['work', 'break'] as const)('pauses and resumes %s without resetting elapsed time', async (mode) => {
        const timer = useTimerStore.getState();
        timer.setMode(mode);
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1 });
        timer.selectPiece('segment', 'Scales', 2, 'day');
        const totalTime = mode === 'work' ? 120 : 60;
        await timer.startTimer();
        emitState('TICK', totalTime - 7);
        await timer.pauseTimer();
        emitState('PAUSED', totalTime - 7);
        const pausedPieceTime = mode === 'work' ? 113 : 120;
        expect(useTimerStore.getState()).toMatchObject({
            mode, isRunning: false, timeRemaining: totalTime - 7,
            totalTime, pieceTimeRemaining: pausedPieceTime,
        });
        await vi.advanceTimersByTimeAsync(30_000);
        expect(useTimerStore.getState().timeRemaining).toBe(totalTime - 7);
        expect(useTimerStore.getState().pieceTimeRemaining).toBe(pausedPieceTime);

        await timer.startTimer();
        expect(workerMock.postMessage).toHaveBeenLastCalledWith({
            type: 'START', sequence: expect.any(Number),
            payload: { mode, timeRemaining: totalTime - 7, currentIteration: 1, totalIterations: DEFAULT_SETTINGS.iterations },
        });
        expect(useTimerStore.getState()).toMatchObject({ mode, isRunning: true, totalTime });
        emitState('TICK', totalTime - 8);
        expect(useTimerStore.getState().pieceTimeRemaining).toBe(mode === 'work' ? 112 : 120);
        expect(addDetailedPracticeTime).toHaveBeenCalledTimes(mode === 'work' ? 2 : 0);
        if (mode === 'work') {
            expect(addDetailedPracticeTime).toHaveBeenNthCalledWith(1, 'segment', 'Scales', 7);
            expect(addDetailedPracticeTime).toHaveBeenNthCalledWith(2, 'segment', 'Scales', 1);
        }
        expect(addPracticeTime).not.toHaveBeenCalled();
    });

    it('preserves work mode when resuming at exactly the configured break duration', async () => {
        const timer = useTimerStore.getState();
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1 });
        await timer.startTimer();
        emitState('TICK', 60);
        await timer.pauseTimer();
        emitState('PAUSED', 60);
        await timer.startTimer();
        expect(useTimerStore.getState()).toMatchObject({ mode: 'work', timeRemaining: 60, totalTime: 120 });
    });

    it('excludes paused segment time while continuing to count general work time', async () => {
        const timer = useTimerStore.getState();
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1 });
        timer.selectPiece('segment', 'Scales', 1, 'day');
        await timer.startTimer();
        emitState('TICK', 115);
        timer.togglePausePiece();
        emitState('TICK', 108);
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, isPiecePaused: true, pieceTimeRemaining: 55 });
        expect(addPracticeTime).toHaveBeenCalledExactlyOnceWith(7);
        expect(addDetailedPracticeTime).toHaveBeenCalledExactlyOnceWith('segment', 'Scales', 5);
        timer.togglePausePiece();
        emitState('TICK', 105);
        expect(useTimerStore.getState()).toMatchObject({ isPiecePaused: false, pieceTimeRemaining: 52 });
        expect(addDetailedPracticeTime).toHaveBeenNthCalledWith(2, 'segment', 'Scales', 3);
        expect(logSegmentCompletion).not.toHaveBeenCalled();
    });

    it('completes a segment once, including plan check, event and sound, then logs general time', async () => {
        const completed = vi.fn();
        window.addEventListener('piece-timer-complete', completed);
        try {
            const timer = useTimerStore.getState();
            timer.selectPiece('segment', 'Scales', 1, 'day');
            await timer.startTimer();
            const initialTime = useTimerStore.getState().timeRemaining;
            emitState('TICK', initialTime - 60);
            // Duplicate sequenced delivery cannot attribute or complete twice.
            emitMessage('TICK', {
                timeRemaining: initialTime - 60, mode: 'work', currentIteration: 1,
                totalIterations: DEFAULT_SETTINGS.iterations
            }, incomingSequence);
            emitState('TICK', initialTime - 61);
            expect(logSegmentCompletion).toHaveBeenCalledExactlyOnceWith('segment');
            expect(practicePlanApi.checkItem).toHaveBeenCalledExactlyOnceWith([], 'segment');
            expect(completed).toHaveBeenCalledTimes(1);
            expect(completed.mock.calls[0][0].detail).toEqual({ id: 'segment', name: 'Scales' });
            expect(playSound).toHaveBeenCalledExactlyOnceWith('end', 1, DEFAULT_SETTINGS.volume, DEFAULT_SETTINGS.soundType);
            expect(useTimerStore.getState()).toMatchObject({ activePieceId: null, pieceTimeRemaining: 0, pieceTotalTime: 0 });
            expect(addDetailedPracticeTime).toHaveBeenCalledExactlyOnceWith('segment', 'Scales', 60);
            expect(addPracticeTime).toHaveBeenCalledExactlyOnceWith(1);
        } finally {
            window.removeEventListener('piece-timer-complete', completed);
        }
    });

    it('runs segment overtime concurrently with break and ignores piece ticks after stopping or completion', async () => {
        const timer = useTimerStore.getState();
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1 });
        timer.selectPiece('segment', 'Scales', 3, 'day');
        await timer.startTimer();
        emitState('TICK', 0);
        emitState('PAUSED', 0);
        emitState('COMPLETE', 60, 'break');
        expect(useTimerStore.getState()).toMatchObject({ isPieceOvertime: true, pieceTimeRemaining: 60 });
        await timer.startPieceOvertime();
        await timer.startTimer();
        workerMock.postMessage.mockClear();
        emitState('TICK', 59);
        expect(useTimerStore.getState().pieceTimeRemaining).toBe(60);
        emitPieceTick();
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, timeRemaining: 59, pieceTimeRemaining: 59 });
        timer.stopPieceOvertime();
        emitPieceTick();
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, pieceTimeRemaining: 59 });
        expect(workerMock.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PAUSE' }));
        await timer.startPieceOvertime();
        for (let tick = 0; tick < 59; tick++) emitPieceTick();
        expect(logSegmentCompletion).toHaveBeenCalledExactlyOnceWith('segment');
        expect(useTimerStore.getState()).toMatchObject({
            mode: 'break', isRunning: true, timeRemaining: 59,
            activePieceId: null, pieceOvertimeRunning: false,
        });
        expect(workerMock.postMessage).toHaveBeenCalledWith({ type: 'PIECE_TICK_STOP' });
        expect(addDetailedPracticeTime).toHaveBeenCalledTimes(61);
        expect(vi.mocked(addDetailedPracticeTime).mock.calls.reduce((sum, call) => sum + call[2], 0)).toBe(180);
        emitPieceTick();
        emitState('TICK', 58);
        expect(addDetailedPracticeTime).toHaveBeenCalledTimes(61);
        expect(addPracticeTime).not.toHaveBeenCalled();
        expect(logSegmentCompletion).toHaveBeenCalledTimes(1);
    });

    it('attributes background catch-up only once and respects paused segments', async () => {
        const timer = useTimerStore.getState();
        timer.setSettings({ ...DEFAULT_SETTINGS, workDuration: 2, breakDuration: 1 });
        timer.selectPiece('segment', 'Scales', 1, 'day');
        await timer.startTimer();
        timer.setTimeRemaining(100);
        timer.setTimeRemaining(100);
        emitState('TICK', 100);
        expect(addDetailedPracticeTime).toHaveBeenCalledExactlyOnceWith('segment', 'Scales', 20);
        expect(useTimerStore.getState().pieceTimeRemaining).toBe(40);
        timer.togglePausePiece();
        timer.setTimeRemaining(90);
        expect(addPracticeTime).toHaveBeenCalledExactlyOnceWith(10);
        expect(useTimerStore.getState().pieceTimeRemaining).toBe(40);
        timer.togglePausePiece();
        timer.setTimeRemaining(50);
        timer.setTimeRemaining(50);
        emitState('TICK', 50);
        expect(addDetailedPracticeTime).toHaveBeenNthCalledWith(2, 'segment', 'Scales', 40);
        expect(addDetailedPracticeTime).toHaveBeenCalledTimes(2);
        expect(logSegmentCompletion).toHaveBeenCalledExactlyOnceWith('segment');
        expect(useTimerStore.getState()).toMatchObject({ activePieceId: null, timeRemaining: 50 });
    });

    it('does not attribute background adjustments while paused or during break', async () => {
        const timer = useTimerStore.getState();
        timer.selectPiece('segment', 'Scales', 1, 'day');
        timer.setTimeRemaining(100);
        timer.setMode('break');
        timer.setSettings({ ...DEFAULT_SETTINGS, breakDuration: 1 });
        await timer.startTimer();
        timer.setTimeRemaining(30);
        timer.setTimeRemaining(40);
        expect(useTimerStore.getState()).toMatchObject({ timeRemaining: 40, pieceTimeRemaining: 60 });
        expect(addPracticeTime).not.toHaveBeenCalled();
        expect(addDetailedPracticeTime).not.toHaveBeenCalled();
        expect(logSegmentCompletion).not.toHaveBeenCalled();
    });

    it('shares live timer state across hook surfaces and keeps ticking after they unmount', async () => {
        const first = renderHook(() => useTimerStore());
        const second = renderHook(() => useTimerStore());
        await act(async () => {
            first.result.current.selectPiece('segment', 'Scales', 1, 'day');
            await first.result.current.startTimer();
        });
        const initialTime = useTimerStore.getState().timeRemaining;
        act(() => emitState('TICK', initialTime - 1));
        expect(first.result.current).toBe(second.result.current);
        expect(second.result.current.pieceTimeRemaining).toBe(59);
        first.unmount();
        act(() => emitState('TICK', initialTime - 2));
        expect(second.result.current).toMatchObject({ isRunning: true, timeRemaining: initialTime - 2, pieceTimeRemaining: 58 });
        second.unmount();
        emitState('TICK', initialTime - 3);
        const remounted = renderHook(() => useTimerStore());
        expect(remounted.result.current).toMatchObject({ isRunning: true, timeRemaining: initialTime - 3, pieceTimeRemaining: 57 });
        expect(addMessageHandler).toHaveBeenCalledTimes(1);
        expect(removeMessageHandler).not.toHaveBeenCalled();
        expect(workerMock.terminate).not.toHaveBeenCalled();
        expect(addDetailedPracticeTime).toHaveBeenCalledTimes(3);
    });
});
