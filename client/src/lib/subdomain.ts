/**
 * Detects which subdomain the app is running on.
 * - repertoire.practice-mate.app → 'repertoire'
 * - timer.practice-mate.app → 'timer'
 * - practice-mate.app or localhost → 'timer' (default)
 */
export function getSubdomain(): 'timer' | 'repertoire' {
    const hostname = window.location.hostname;

    if (hostname.startsWith('repertoire.')) {
        return 'repertoire';
    }

    return 'timer';
}

export function isRepertoireSubdomain(): boolean {
    return getSubdomain() === 'repertoire';
}
