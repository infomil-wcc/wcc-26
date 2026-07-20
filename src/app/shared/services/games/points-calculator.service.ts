import { Injectable } from '@angular/core';

export interface PointsBreakdown {
  winner: number;
  fulltime: number;
  halftime: number;
  scorer: number;
  consolation: number;
  total: number;
  isFraud: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PointsCalculatorService {

  constructor() { }

  /**
   * Helper function to append Mauritian timezone offset (+04:00) 
   * if the ISO string has no timezone descriptor.
   */
  public parseMauritianDate(dateStr: string): number {
    if (!dateStr) return 0;
    let normalized = String(dateStr).trim();

    // Replace space with T for cross-browser support (e.g., Safari/Firefox)
    normalized = normalized.replace(' ', 'T');

    return new Date(normalized).getTime();
  }

  public convertDirectusToMauritianString(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    // Directus sends UTC. Add 4 hours for Mauritius.
    d.setUTCHours(d.getUTCHours() + 4);
    return d.toISOString().replace('.000Z', '').replace('Z', '');
  }

  /**
   * Checks if a prediction is considered fraudulent based on its modification date 
   * relative to the match's kickoff time.
   */
  public isPredictionFraud(match: any, prediction: any): boolean {
    if (!prediction || !match.date) return false;

    const dateToUse = prediction.modified_on ? prediction.modified_on : prediction.created_on;
    if (!dateToUse) return false;

    const mauritianStr = this.convertDirectusToMauritianString(dateToUse);
    const predTimestamp = this.parseMauritianDate(mauritianStr);
    const matchTimestamp = this.parseMauritianDate(match.date);

    // Returns true if the prediction was made/modified AFTER or AT the exact match kick-off time
    return predTimestamp >= matchTimestamp;
  }

  public calculatePoints(match: any, prediction: any, rules: any[]): PointsBreakdown {
    const targetPhase = match.phase === 'Third Place' ? 'Final' : match.phase;
    const rule = rules?.find((r: any) => r.game_type === 'pronostics' && r.phase === targetPhase) || {
      winner_draw_points: 0,
      fulltime_exact_points: 0,
      halftime_exact_points: 0,
      scorer_points: 0,
      consolation_points: 0
    };

    const breakdown: PointsBreakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
    let accurateFieldsCount = 0;

    if (this.isPredictionFraud(match, prediction)) {
      breakdown.isFraud = true;
      return breakdown;
    }

    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null || match.fulltime_a === undefined || match.fulltime_b === undefined || match.fulltime_a === '' || match.fulltime_b === '') {
      return breakdown;
    }

    const getScore = (val: any) => (val === '-' || val === null || val === undefined || val === '') ? 0 : parseInt(val, 10);
    // Matches backend normalizePlayerName exactly: NFD + remove accents + lowercase + remove punctuation + split words + sort + join
    const normalizeName = (str: string): string => {
      if (!str || typeof str !== 'string') return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // remove accents
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')     // remove punctuation
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(' ')
        .trim();
    };

    let inferredWinnerDraw = prediction.winner_draw;

    if (match.phase !== 'Group Stage') {
      if (!inferredWinnerDraw || inferredWinnerDraw.trim() === '') {
        const hasScoreA = (prediction.fulltime_a !== null && prediction.fulltime_a !== undefined && prediction.fulltime_a !== '' && prediction.fulltime_a !== '-');
        const hasScoreB = (prediction.fulltime_b !== null && prediction.fulltime_b !== undefined && prediction.fulltime_b !== '' && prediction.fulltime_b !== '-');
        if (hasScoreA || hasScoreB) {
          const pScoreA = getScore(prediction.fulltime_a);
          const pScoreB = getScore(prediction.fulltime_b);
          if (pScoreA > pScoreB) inferredWinnerDraw = match.team_a;
          else if (pScoreA < pScoreB) inferredWinnerDraw = match.team_b;
          else inferredWinnerDraw = 'Draw';
        }
      }
    }

    const isWinnerDrawCorrect = match.winner_draw === inferredWinnerDraw;
    const isFulltimeExact = getScore(match.fulltime_a) === getScore(prediction.fulltime_a) &&
      getScore(match.fulltime_b) === getScore(prediction.fulltime_b);
    const isHalftimeExact = getScore(match.halftime_a) === getScore(prediction.halftime_a) &&
      getScore(match.halftime_b) === getScore(prediction.halftime_b);

    if (isWinnerDrawCorrect && Number(rule.winner_draw_points) > 0) {
      breakdown.winner = Number(rule.winner_draw_points);
      accurateFieldsCount++;
    }
    if (isFulltimeExact && Number(rule.fulltime_exact_points) > 0) {
      breakdown.fulltime = Number(rule.fulltime_exact_points);
      accurateFieldsCount++;
    }
    if (match.phase !== 'Round of 32' && isHalftimeExact && Number(rule.halftime_exact_points) > 0) {
      breakdown.halftime = Number(rule.halftime_exact_points);
      accurateFieldsCount++;
    }

    if (prediction.scorer && Number(rule.scorer_points) > 0 && match.scorers) {
      let matchScorersList: string[] = [];
      try {
        const parsed = typeof match.scorers === 'string' ? JSON.parse(match.scorers) : match.scorers;
        matchScorersList = (Array.isArray(parsed) ? parsed : [parsed]).map((s: any) => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || ''));
      } catch {
        matchScorersList = match.scorers.split(',').map((s: string) => s.trim());
      }

      const normalizedProno = normalizeName(prediction.scorer);
      if (matchScorersList.some((s: string) => normalizeName(s) === normalizedProno)) {
        breakdown.scorer = Number(rule.scorer_points);
        accurateFieldsCount++;
      }
    }

    if (match.phase !== 'Group Stage' && match.phase !== 'Round of 32') {
      // Consolation: only when rule grants it AND no field was correct — matches backend
      if (accurateFieldsCount === 0 && Number(rule.consolation_points) > 0) {
        breakdown.consolation = Number(rule.consolation_points);
      }
      breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;
      // Guaranteed minimum 1 point for knockout phases — matches backend calc-knockout-stage.mjs
      if (breakdown.total === 0) {
        breakdown.consolation = 1;
        breakdown.total = 1;
      }
    } else {
      breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer;
    }

    return breakdown;
  }
}