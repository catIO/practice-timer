import { describe, it, expect } from 'vitest';
import { getUrlPreview } from './utils';

describe('getUrlPreview', () => {
  it('returns empty string for empty input', () => {
    expect(getUrlPreview('')).toBe('');
  });

  it('removes protocol and www', () => {
    expect(getUrlPreview('https://www.google.com')).toBe('google.com');
    expect(getUrlPreview('http://google.com')).toBe('google.com');
  });

  it('keeps subdomains other than www', () => {
    expect(getUrlPreview('https://drive.google.com')).toBe('drive.google.com');
  });

  it('handles relative-like URLs or URLs without protocol', () => {
    expect(getUrlPreview('google.com/search?q=test')).toBe('google.com/search?q=test');
  });

  it('truncates long paths while keeping the domain intact', () => {
    const longUrl = 'https://musescore.com/user/32185698/scores/123456789012345678901234567890';
    const preview = getUrlPreview(longUrl);
    expect(preview.startsWith('musescore.com')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(60);
    expect(preview.endsWith('...')).toBe(true);
  });

  it('handles invalid URLs gracefully by fallback truncation', () => {
    const invalidLong = 'this-is-not-a-valid-url-but-it-is-very-long-and-should-be-truncated-eventually';
    const preview = getUrlPreview(invalidLong);
    expect(preview.length).toBeLessThanOrEqual(60);
    expect(preview.endsWith('...')).toBe(true);
  });
});
