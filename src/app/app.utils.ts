/**
 * Extracts the earliest parsed Date from a raw matches array.
 * Returns null if no valid dates are found.
 */
export function getEarliestMatchDate(matches: any[]): Date | null {
  if (!matches?.length) return null;

  const sorted = matches
    .map((m: any) => ({ parsedDate: m.date ? new Date(m.date) : null }))
    .filter((m): m is { parsedDate: Date } => m.parsedDate !== null && !isNaN(m.parsedDate.getTime()))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  return sorted.length > 0 ? sorted[0].parsedDate : null;
}

/**
 * Returns true if a kickoff Date has already passed (or is now).
 */
export function hasKickoffPassed(kickoff: Date | null): boolean {
  return kickoff !== null && new Date() >= kickoff;
}

/**
 * Clears auth cookies by key names.
 */
export const AUTH_COOKIE_KEYS = ['currentToken', 'currentUser'] as const;
