/**
 * Subtracts a specific number of minutes from a date.
 */
export function subtractMinutes(date: Date | string, minutes: number): Date {
  const newDate = new Date(date);
  newDate.setTime(newDate.getTime() - (minutes * 60 * 1000));
  return newDate;
}

/**
 * Checks if the prediction payload was submitted after the match kickoff time.
 */
export function checkPayloadFraud(pred: any, matchDate: string): { isFraud: boolean; invalidatedDate: Date | null } {
  if (!pred || !matchDate) {
    return { isFraud: false, invalidatedDate: null };
  }
  const predTimeStr = pred.modified_on || pred.created_on;
  if (!predTimeStr) {
    return { isFraud: false, invalidatedDate: null };
  }

  let normalizedMatchDate = matchDate.trim();
  if (!normalizedMatchDate.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalizedMatchDate)) {
    normalizedMatchDate += '+04:00';
  }
  normalizedMatchDate = normalizedMatchDate.replace(' ', 'T');

  const predTimestamp = new Date(predTimeStr).getTime();
  const matchTimestamp = new Date(normalizedMatchDate).getTime();
  const invalidatedDate = new Date(predTimeStr);

  return {
    isFraud: predTimestamp >= matchTimestamp,
    invalidatedDate
  };
}
