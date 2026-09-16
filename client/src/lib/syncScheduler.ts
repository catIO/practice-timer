/**
 * Coalesce frequent local edits without postponing uploads indefinitely.
 * This is an in-memory scheduling boundary, NOT a durable offline outbox.
 */
export function createSyncScheduler(flush: () => void, maxWaitMs = 5000) {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimeout: ReturnType<typeof setTimeout> | null = null;

    const cancel = () => {
        if (debounceTimeout !== null) clearTimeout(debounceTimeout);
        if (maxWaitTimeout !== null) clearTimeout(maxWaitTimeout);
        debounceTimeout = null;
        maxWaitTimeout = null;
    };

    const flushNow = () => {
        cancel();
        flush();
    };

    const schedule = (delayMs = 2000) => {
        if (delayMs <= 0) {
            flushNow();
            return;
        }

        if (debounceTimeout !== null) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(flushNow, delayMs);
        // The deadline belongs to the first pending edit, not the latest tick.
        if (maxWaitTimeout === null) {
            maxWaitTimeout = setTimeout(flushNow, maxWaitMs);
        }
    };

    return { schedule, cancel };
}