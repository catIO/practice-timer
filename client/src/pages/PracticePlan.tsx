import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PracticePlanPane } from "@/components/PracticePlanPane";
import { useTimerStore } from "@/stores/timerStore";
import { playSound, resumeAudioContext } from "@/lib/soundEffects";
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/hooks/useNotification";

export default function PracticePlan() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { showNotification } = useNotification();

    const timeRemaining = useTimerStore((state) => state.timeRemaining);
    const totalTime = useTimerStore((state) => state.totalTime);
    const mode = useTimerStore((state) => state.mode);
    const isRunning = useTimerStore((state) => state.isRunning);
    const isPracticeComplete = useTimerStore((state) => state.isPracticeComplete);
    const startTimer = useTimerStore((state) => state.startTimer);
    const pauseTimer = useTimerStore((state) => state.pauseTimer);
    const skipTimer = useTimerStore((state) => state.skipTimer);
    const startNewSession = useTimerStore((state) => state.startNewSession);

    // Re-register the timer event handlers that normally live in useTimer (Home).
    // These are lost when Home unmounts on navigation to this route.
    useEffect(() => {
        const handlePlaySound = async (event: Event) => {
            const { numberOfBeeps, volume, soundType } = (event as CustomEvent).detail;
            try {
                await resumeAudioContext();
                let vol = volume <= 1 ? volume * 100 : volume;
                vol = Math.min(100, Math.max(0, vol));
                if (vol > 0) await playSound('end', numberOfBeeps, vol, soundType);
            } catch (e) {
                console.error('PracticePlan: error playing sound', e);
            }
        };

        const handleTimerComplete = async () => {
            showNotification('Timer Complete!', {
                body: 'Your timer has finished!',
                requireInteraction: true,
                silent: false,
            });
            const store = useTimerStore.getState();
            if (store.settings.soundEnabled) {
                try {
                    await resumeAudioContext();
                    let vol = store.settings.volume <= 1 ? store.settings.volume * 100 : store.settings.volume;
                    vol = Math.min(100, Math.max(0, vol));
                    if (vol > 0) await playSound('end', store.settings.numberOfBeeps, vol, store.settings.soundType as any);
                } catch (e) {
                    console.error('PracticePlan: error playing timer-complete sound', e);
                }
            }
            toast({ title: 'Timer Complete', description: 'Your timer has finished!' });
        };

        const handlePracticeComplete = async (event: Event) => {
            const detail = (event as CustomEvent).detail;
            const store = useTimerStore.getState();
            if (store.settings.soundEnabled) {
                try {
                    await resumeAudioContext();
                    let vol = store.settings.volume <= 1 ? store.settings.volume * 100 : store.settings.volume;
                    vol = Math.min(100, Math.max(0, vol));
                    if (vol > 0) await playSound('end', store.settings.numberOfBeeps, vol, store.settings.soundType as any);
                } catch (e) {
                    console.error('PracticePlan: error playing practice-complete sound', e);
                }
            }
            // These calls are critical — without them the completion screen never shows
            store.setIsPracticeComplete(true);
            store.setIsRunning(false);
            showNotification('Practice Complete!', {
                body: `You've completed all ${detail?.totalIterations} work sessions!`,
                requireInteraction: true,
                silent: false,
            });
        };

        window.addEventListener('play-sound', handlePlaySound);
        window.addEventListener('timer-complete', handleTimerComplete);
        window.addEventListener('practice-complete', handlePracticeComplete);
        return () => {
            window.removeEventListener('play-sound', handlePlaySound);
            window.removeEventListener('timer-complete', handleTimerComplete);
            window.removeEventListener('practice-complete', handlePracticeComplete);
        };
    }, [toast, showNotification]);

    return (
        <PracticePlanPane
            open={true}
            onOpenChange={(open) => { if (!open) navigate("/"); }}
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            mode={mode}
            isRunning={isRunning}
            isPracticeComplete={isPracticeComplete}
            onStart={startTimer}
            onPause={pauseTimer}
            onSkip={skipTimer}
            onStartNewSession={startNewSession}
        />
    );
}
