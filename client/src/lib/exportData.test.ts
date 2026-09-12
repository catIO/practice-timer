import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAllPracticeData } from './exportData';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('exportAllPracticeData', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('exports saved localStorage keys to a JSON blob download', () => {
    localStorageMock.setItem('practice-timer-settings', JSON.stringify({ theme: 'dark' }));
    localStorageMock.setItem('practice-timer-plan', JSON.stringify([{ id: '1', title: 'Prelude' }]));

    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('div'));
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('div'));
    
    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:test-url';
    const createObjectURLMock = vi.fn().mockReturnValue(mockUrl);
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const result = exportAllPracticeData();

    expect(result.count).toBe(2);
    expect(result.filename).toMatch(/^practice-mate-data-\d{4}-\d{2}-\d{2}\.json$/);
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith(mockUrl);
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
