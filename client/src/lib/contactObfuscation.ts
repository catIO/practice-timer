/**
 * Email Obfuscation and Anti-Harvesting Utility
 * 
 * Protects email addresses from automated crawlers, scrapers, and bot harvesting:
 * 1. Base64/chunk encoded at rest — does not appear as raw email string in HTML/bundles.
 * 2. Assembled dynamically in memory only on user interaction.
 * 3. Mailto URL is created and dispatched only in response to explicit user click events.
 */

const ENCODED_PARTS = ['aGVsbG8=', 'Y2F0aGVyaW5hLmRldg==']; // 'hello' and 'catherina.dev'

export function getDecodedContactEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const user = window.atob(ENCODED_PARTS[0]);
    const domain = window.atob(ENCODED_PARTS[1]);
    return `${user}@${domain}`;
  } catch {
    return ['hello', 'catherina.dev'].join('@');
  }
}

/**
 * Returns a human-readable display string formatted to avoid regex email scraping.
 * e.g., "hello [at] catherina.dev"
 */
export function getProtectedDisplayEmail(): string {
  return 'hello [at] catherina.dev';
}

/**
 * Dynamically launches user's default email client on click without exposing
 * static mailto links in the DOM.
 */
export function openProtectedMailto(options?: { subject?: string; body?: string }): void {
  const email = getDecodedContactEmail();
  if (!email) return;

  const params: string[] = [];
  if (options?.subject) {
    params.push(`subject=${encodeURIComponent(options.subject)}`);
  }
  if (options?.body) {
    params.push(`body=${encodeURIComponent(options.body)}`);
  }

  const queryString = params.length > 0 ? `?${params.join('&')}` : '';
  window.location.href = `mailto:${email}${queryString}`;
}

/**
 * Copies the decoded email to clipboard with user interaction
 */
export async function copyProtectedEmail(): Promise<boolean> {
  const email = getDecodedContactEmail();
  if (!email) return false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(email);
      return true;
    }
  } catch {
    // Fallback if clipboard API unavailable
  }
  return false;
}
