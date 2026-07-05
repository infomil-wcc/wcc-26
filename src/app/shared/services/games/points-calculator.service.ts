import { Injectable } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { Pronostiques } from '../../contracts/pronostiques.contract';

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
  private parseMauritianDate(dateStr: string): number {
    if (!dateStr) return 0;
    let normalized = dateStr.trim();
    
    // If the string doesn't specify Z or an offset (+/-), append the Mauritian timezone offset (+04:00)
    if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
      normalized += '+04:00';
    }
    return new Date(normalized).getTime();
  }

  /**
   * Checks if a prediction is considered fraudulent based on its modification date 
   * relative to the match's kickoff time.
   */
  isPredictionFraud(match: Matches, prediction: Pronostiques): boolean {
    if (!prediction || !match.date) return false;
    
    const dateToUse = prediction.modified_on ? prediction.modified_on : prediction.created_on;
    if (!dateToUse) return false;

    const predTimestamp = this.parseMauritianDate(dateToUse);
    const matchTimestamp = this.parseMauritianDate(match.date);

    // Returns true if the prediction was made/modified AFTER or AT the exact match kick-off time
    return predTimestamp >= matchTimestamp;
  }

  calculatePoints(match: Matches, prediction: Pronostiques): PointsBreakdown {
    const breakdown: PointsBreakdown = {
      winner: 0,
      fulltime: 0,
      halftime: 0,
      scorer: 0,
      consolation: 0,
      total: 0,
      isFraud: false
    };

    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null) {
      return breakdown;
    }

    if (this.isPredictionFraud(match, prediction)) {
      breakdown.isFraud = true;
      return breakdown;
    }

    const winnerPts = Number(match.winner_point) || 0;
    const fulltimePts = Number(match.fulltime_point) || 0;
    const halftimePts = Number(match.halftime_point) || 0;
    const scorerPts = Number(match.scorer_point) || 0;

    const isOutcomeCorrect = prediction.winner_draw === match.winner_draw;
    
    // Fallback any stored null, undefined, or empty values safely to 0
    const predFulltimeA = parseInt(prediction.fulltime_a === null || prediction.fulltime_a === undefined || prediction.fulltime_a === '' ? '0' : prediction.fulltime_a, 10);
    const predFulltimeB = parseInt(prediction.fulltime_b === null || prediction.fulltime_b === undefined || prediction.fulltime_b === '' ? '0' : prediction.fulltime_b, 10);
    const matchFulltimeA = parseInt(match.fulltime_a as any, 10);
    const matchFulltimeB = parseInt(match.fulltime_b as any, 10);
    const isFulltimeCorrect = predFulltimeA === matchFulltimeA && predFulltimeB === matchFulltimeB;

    const predHalftimeA = parseInt(prediction.halftime_a === null || prediction.halftime_a === undefined || prediction.halftime_a === '' ? '0' : prediction.halftime_a, 10);
    const predHalftimeB = parseInt(prediction.halftime_b === null || prediction.halftime_b === undefined || prediction.halftime_b === '' ? '0' : prediction.halftime_b, 10);
    const matchHalftimeA = parseInt(match.halftime_a as any, 10);
    const matchHalftimeB = parseInt(match.halftime_b as any, 10);
    const isHalftimeCorrect = predHalftimeA === matchHalftimeA && predHalftimeB === matchHalftimeB;
    const shouldEvaluateHalftime = (match.phase || '') !== 'Round of 32';

    let isScorerCorrect = false;
    if (prediction.scorer && match.scorers) {
       // Replicate backend normalization: remove accents, lowercase, remove punctuation, split, sort, join
       const normalizeName = (name: string) => {
         if (!name || typeof name !== 'string') return '';
         return name
           .normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .toLowerCase()
           .replace(/[^a-z0-9\s]/g, "")
           .split(/\s+/)
           .filter(Boolean)
           .sort()
           .join(' ')
           .trim();
       };

       const predictedScorer = normalizeName(prediction.scorer);
       let matchScorersNames: string[] = [];
       if (Array.isArray(match.scorers)) {
          matchScorersNames = match.scorers.map((s: any) => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || '')).filter(Boolean);
       } else if (typeof match.scorers === 'string') {
          try {
             const parsed = JSON.parse(match.scorers);
             if (Array.isArray(parsed)) {
                matchScorersNames = parsed.map((s: any) => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || '')).filter(Boolean);
             }
          } catch (e) {
             matchScorersNames = [match.scorers as string];
          }
       }
       
       isScorerCorrect = matchScorersNames.some(s => normalizeName(s) === predictedScorer);
    }

    if (isOutcomeCorrect && winnerPts > 0) {
      breakdown.winner += winnerPts;
    }

    if (isFulltimeCorrect && fulltimePts > 0) {
      breakdown.fulltime += fulltimePts;
    }

    if (shouldEvaluateHalftime && isHalftimeCorrect && halftimePts > 0) {
      breakdown.halftime += halftimePts;
    }

    if (isScorerCorrect && scorerPts > 0) {
      breakdown.scorer += scorerPts;
    }

    breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;
    
    if (['Round of 16', 'Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(match.phase || '')) {
       if (breakdown.total === 0) {
           breakdown.consolation = 1; 
           breakdown.total = 1;
       }
    }

    return breakdown;
  }
}