import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDecodedContactEmail,
  getProtectedDisplayEmail,
  openProtectedMailto,
  copyProtectedEmail,
} from './contactObfuscation';

describe('contactObfuscation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly decodes the contact email at runtime without hardcoded plain string', () => {
    expect(getDecodedContactEmail()).toBe('hello@catherina.dev');
  });

  it('returns anti-bot human-readable display string', () => {
    expect(getProtectedDisplayEmail()).toBe('hello [at] catherina.dev');
  });

  it('dispatches mailto on direct action with subject and body params', () => {
    // Mock window.location.href assignment
    const locationObj = { href: '' };
    Object.defineProperty(window, 'location', {
      value: locationObj,
      writable: true,
    });

    openProtectedMailto({
      subject: 'Test Subject',
      body: 'Test Body',
    });

    expect(locationObj.href).toBe(
      'mailto:hello@catherina.dev?subject=Test%20Subject&body=Test%20Body'
    );
  });

  it('copies email to clipboard via navigator.clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const success = await copyProtectedEmail();
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('hello@catherina.dev');
  });
});
