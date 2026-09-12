/**
 * Gathers all Practice Mate data stored in browser localStorage
 * and triggers a JSON file download for backup and data portability.
 */
export function exportAllPracticeData(): { count: number; filename: string } {
  const exportPayload: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    version: '1.0.1',
    appName: 'Practice Mate',
    author: 'Practice Lab (https://practice-lab.net)',
    data: {} as Record<string, any>,
  };

  const keysToExport = [
    'practice-timer-settings',
    'practice-timer-plan',
    'practice-timer-lesson-plan',
    'practice-timer-logs',
    'practice-timer-detailed-logs',
    'practice-timer-completion-history',
    'practice-timer-segment-timeboxes',
    'practice-timer-progress',
    'local_shared_reports',
  ];

  let keysFound = 0;
  for (const key of keysToExport) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        keysFound++;
        try {
          exportPayload.data[key] = JSON.parse(raw);
        } catch {
          exportPayload.data[key] = raw;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `practice-mate-data-${dateStr}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { count: keysFound, filename };
}
