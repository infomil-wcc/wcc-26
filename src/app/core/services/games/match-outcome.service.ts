import { Injectable } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';
import { Pronostiques } from '../../../shared/contracts/pronostiques.contract';
import { PointsCalculatorService } from './points-calculator.service';

@Injectable({
  providedIn: 'root'
})
export class MatchOutcomeService {
  constructor(private pointsCalculator: PointsCalculatorService) {}

  calculateWinDraw(matchPhase: string, penaltyWinner: string | null, teamA: string, teamB: string, scoreA: number | null, scoreB: number | null): string {
    if (scoreA === null || scoreA === undefined || scoreB === null || scoreB === undefined) {
      return '';
    }
    let outcome: string;

    (scoreA > scoreB) ? outcome = teamA : outcome = teamB;
    if (scoreA === scoreB) {
      if (matchPhase !== 'Group Stage' && penaltyWinner) {
        outcome = penaltyWinner;
      } else {
        outcome = 'Draw';
      }
    }

    return outcome;
  }

  isMatchFinishedByDate(matchDate: string, today: Date = new Date()): boolean {
    if (!matchDate) {
      return false;
    }
    return new Date(matchDate) < today;
  }

  isOutcomeCorrect(prediction: any, match: Matches, hidePointsBadge: boolean): boolean {
    if (hidePointsBadge) return false; 
    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null || hidePointsBadge) {
      return false;
    }
    return prediction.winner_draw === match.winner_draw;
  }

  isFulltimeCorrect(prediction: any, match: Matches, hidePointsBadge: boolean): boolean {
    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null || hidePointsBadge) {
      return false;
    }
    const predA = parseInt(prediction.fulltime_a, 10);
    const predB = parseInt(prediction.fulltime_b, 10);
    return predA === match.fulltime_a && predB === match.fulltime_b;
  }

  isHalftimeCorrect(prediction: any, match: Matches, hidePointsBadge: boolean): boolean {
    if (!prediction || !match || match.halftime_a === null || match.halftime_b === null || hidePointsBadge) {
      return false;
    }
    const predA = parseInt(prediction.halftime_a, 10);
    const predB = parseInt(prediction.halftime_b, 10);
    return predA === match.halftime_a && predB === match.halftime_b;
  }

  getMatchPoints(prediction: any, match: Matches, hidePointsBadge: boolean): number | null {
    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null || hidePointsBadge) {
      return null;
    }
    const breakdown = this.pointsCalculator.calculatePoints(match, prediction as Pronostiques);
    return breakdown.isFraud ? 0 : breakdown.total;
  }

  isConsolationPointAwarded(prediction: any, match: Matches, hidePointsBadge: boolean): boolean {
    if (!prediction || !match || match.fulltime_a === null || match.fulltime_b === null || hidePointsBadge) {
      return false;
    }
    if (match.phase === 'Group Stage' || match.phase === 'Round of 32') {
      return false;
    }
    const pts = this.getMatchPoints(prediction, match, hidePointsBadge);
    return pts === 1 && !this.isOutcomeCorrect(prediction, match, hidePointsBadge) && !this.isFulltimeCorrect(prediction, match, hidePointsBadge) && !this.isHalftimeCorrect(prediction, match, hidePointsBadge);
  }
}
