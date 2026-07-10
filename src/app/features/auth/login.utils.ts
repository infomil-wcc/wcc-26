/**
 * Generates a random 5-digit confirmation code.
 */
export function generateConfirmationCode(): number {
  return Math.floor(Math.random() * 90000) + 10000;
}

/**
 * Trims whitespace and strips the domain part of an email if the user enters/pastes a full email.
 */
export function sanitizeEmailInput(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    return trimmed.split('@')[0];
  }
  return trimmed;
}
