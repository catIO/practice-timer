import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncScheduler } from './syncScheduler';

describe('sync scheduler', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('coalesces short bursts of edits', () => {
    const flush = vi.fn();
    const scheduler = createSyncScheduler(flush);
    scheduler.schedule();
    vi.advanceTimersByTime(1000);
    scheduler.schedule();
    vi.advanceTimersByTime(1999);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flushes continuous timer ticks at bounded intervals rather than starving', () => {
    const flush = vi.fn();
    const scheduler = createSyncScheduler(flush);
    for (let tick = 0; tick < 15; tick++) {
      scheduler.schedule(5000);
      vi.advanceTimersByTime(1000);
    }
    expect(flush).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flushes pause/background requests immediately without a duplicate later', () => {
    const flush = vi.fn();
    const scheduler = createSyncScheduler(flush);
    scheduler.schedule(5000);
    vi.advanceTimersByTime(500);
    scheduler.schedule(0);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('can cancel pending work without flushing', () => {
    const flush = vi.fn();
    const scheduler = createSyncScheduler(flush);
    scheduler.schedule();
    scheduler.cancel();
    vi.advanceTimersByTime(10000);
    expect(flush).not.toHaveBeenCalled();
  });

  it('keeps independently instantiated channels isolated', () => {
    const practice = vi.fn();
    const lesson = vi.fn();
    const practiceScheduler = createSyncScheduler(practice);
    const lessonScheduler = createSyncScheduler(lesson);
    practiceScheduler.schedule();
    lessonScheduler.schedule();
    practiceScheduler.cancel();
    vi.advanceTimersByTime(2000);
    expect(practice).not.toHaveBeenCalled();
    expect(lesson).toHaveBeenCalledTimes(1);
  });
});