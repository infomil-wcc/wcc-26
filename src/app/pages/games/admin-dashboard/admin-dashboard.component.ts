import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { PredictionsApiService } from '../../../shared/services/api/predictions-api.service';
import { RulesApiService } from '../../../shared/services/api/rules-api.service';
import { AuthService } from '../../../shared/services/core/auth.service';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { RankingsService } from '../../../shared/services/content/rankings.service';
import { PronosticsRankingsApiService } from '../../../shared/services/api/pronostics-rankings-api.service';
import { forkJoin, of, timeout } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface FraudReport {
  user: string;
  matchId: number;
  matchName: string;
  kickoff: Date;
  submittedAt: Date | null;
  modifiedAt: Date | null;
  reason: string;
}

interface PlayerStats {
  username: string;
  email: string;
  totalPredictions: number;
  modifiedCount: number;
  directusPoints: number;
  calculatedPoints: number;
  pointDiscrepancy: boolean;
  hasFraud: boolean;
  averageGoalsPredicted: number;
  predictionsDetail: any[];
  formGuide: string[];
  pointsByPhase: { [key: string]: number };
  homePredictionsPct: number;
  awayPredictionsPct: number;
  drawPredictionsPct: number;
  averageLeadTimeMinutes: number;
  isCalculating?: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private matchesService = inject(MatchesService);
  private predictionsApi = inject(PredictionsApiService);
  private rulesApi = inject(RulesApiService);
  private authService = inject(AuthService);
  private cookieService = inject(CookieService);
  private rankingsService = inject(RankingsService);
  private pronosticsRankingsApi = inject(PronosticsRankingsApiService);

  isLoading = true;
  errorMessage = '';

  matches: any[] = [];
  predictions: any[] = [];
  rules: any[] = [];
  users: any[] = [];
  rankings: any[] = [];

  playersReport: PlayerStats[] = [];
  fraudCases: FraudReport[] = [];
  totalDiscrepancies = 0;

  selectedPlayer: PlayerStats | null = null;
  searchTerm = '';

  isRecalculating = false;
  recalcSuccessMessage = '';

  ngOnInit(): void {
    this.loadAdminData();
  }

  recalculateDirectusPoints(): void {
    this.isRecalculating = true;
    this.recalcSuccessMessage = '';
    this.rankingsService.recalculateRankings().subscribe({
      next: (res) => {
        this.recalcSuccessMessage = 'Points recalculés avec succès dans Directus !';
        this.isRecalculating = false;
        this.loadAdminData(); // Reload stats
        setTimeout(() => this.recalcSuccessMessage = '', 5000);
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du recalcul des points : ' + (err.message || err);
        this.isRecalculating = false;
      }
    });
  }

  loadAdminData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const token = this.cookieService.get('currentToken');

    if (!token) {
      this.errorMessage = 'Veuillez vous reconnecter (Token invalide/absent)';
      this.isLoading = false;
      return;
    }

    const httpOptions = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    // 1. Fetch Users and Rankings first with 10s timeout to prevent page hangs
    forkJoin({
      users: this.authService.getUsers(token).pipe(timeout(10000)),
      rankings: this.pronosticsRankingsApi.getRankings('?limit=-1', httpOptions).pipe(
        timeout(10000),
        map(r => r?.data || r || [])
      )
    }).subscribe({
      next: (res: any) => {
        this.users = res.users?.data || res.users || [];
        this.rankings = res.rankings || [];

        // Initialize players list immediately with Directus rankings
        this.playersReport = this.users.map(u => {
          const username = u.first_name || u.last_name || 'Inconnu';
          const key = username.toLowerCase().trim();
          const rankingObj = this.rankings.find(r => (r.key || r.user || '').toLowerCase().trim() === key);
          
          return {
            username: username,
            email: u.email,
            totalPredictions: 0,
            modifiedCount: 0,
            directusPoints: rankingObj ? rankingObj.point : 0,
            calculatedPoints: 0,
            pointDiscrepancy: false,
            hasFraud: false,
            averageGoalsPredicted: 0,
            predictionsDetail: [],
            formGuide: [],
            pointsByPhase: {},
            homePredictionsPct: 0,
            awayPredictionsPct: 0,
            drawPredictionsPct: 0,
            averageLeadTimeMinutes: 0,
            isCalculating: true
          };
        });

        // Hide main page loader immediately so the grid is visible on page load!
        this.isLoading = false;

        // 2. Fetch matches (cached), predictions (filtered), and rules in the background with 15s timeout
        forkJoin({
          matches: this.matchesService.getAllMatches().pipe(timeout(15000), catchError(() => of([]))),
          predictions: this.predictionsApi.getPredictions('?limit=-1&fields=id,user,game_id,fulltime_a,fulltime_b,winner_draw,scorer,created_on,modified_on&filter[fulltime_a][nnull]', httpOptions).pipe(timeout(15000), catchError(() => of({ data: [] }))),
          rules: this.rulesApi.getScoringRules(httpOptions).pipe(timeout(10000), catchError(() => of({ data: [] })))
        }).subscribe({
          next: (bgRes: any) => {
            this.matches = bgRes.matches || [];
            this.predictions = bgRes.predictions?.data || bgRes.predictions || [];
            this.rules = bgRes.rules?.data || bgRes.rules || [];

            this.generateDiagnosticReport();
          },
          error: (bgErr) => {
            console.error('Erreur lors du calcul en arrière-plan:', bgErr);
          }
        });
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de l\'initialisation des données : ' + (err.message || err);
        this.isLoading = false;
      }
    });
  }

  generateDiagnosticReport(): void {
    this.fraudCases = [];
    this.totalDiscrepancies = 0;
    
    // Group predictions by user for O(1) chunk calculations
    const predictionsByUser = new Map<string, any[]>();
    this.predictions.forEach(p => {
      if (!p.user) return;
      const key = p.user.toLowerCase().trim();
      if (!predictionsByUser.has(key)) {
        predictionsByUser.set(key, []);
      }
      predictionsByUser.get(key)!.push(p);
    });

    // 2. Parallelize & process chunks using async timeout ticks to avoid UI blocking
    const rulesList = this.rules;
    let index = 0;
    const chunkSize = 2; // Process 2 players per event loop tick for smooth gradual loading

    const processNextChunk = () => {
      if (index >= this.playersReport.length) {
        return;
      }

      const limit = Math.min(index + chunkSize, this.playersReport.length);
      for (let i = index; i < limit; i++) {
        const stats = this.playersReport[i];
        const userKey = stats.username.toLowerCase().trim();
        const userPredictions = predictionsByUser.get(userKey) || [];

        userPredictions.forEach(p => {
          stats.totalPredictions++;

          // Check if modified
          const createdTime = p.created_on ? new Date(p.created_on) : null;
          const modifiedTime = p.modified_on ? new Date(p.modified_on) : null;
          if (createdTime && modifiedTime && Math.abs(modifiedTime.getTime() - createdTime.getTime()) > 5000) {
            stats.modifiedCount++;
          }

          // Find corresponding match
          const match = this.matches.find(m => String(m.id) === String(p.game_id));
          let pointsEarned = 0;
          let isLate = false;
          let lateReason = '';

          if (match) {
            const kickoffTime = new Date(match.date);
            
            // Late prediction check
            if (createdTime && createdTime > kickoffTime) {
              isLate = true;
              lateReason = 'Création après coup d\'envoi';
            } else if (modifiedTime && modifiedTime > kickoffTime) {
              isLate = true;
              lateReason = 'Modification après coup d\'envoi';
            }

            if (isLate) {
              stats.hasFraud = true;
              this.fraudCases.push({
                user: stats.username,
                matchId: match.id,
                matchName: `${match.team_a} vs ${match.team_b}`,
                kickoff: kickoffTime,
                submittedAt: createdTime,
                modifiedAt: modifiedTime,
                reason: lateReason
              });
            }

            let pointsBreakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0 };
            if (!isLate && match.fulltime_a !== null && match.fulltime_b !== null) {
              pointsBreakdown = this.calculatePoints(match, p, rulesList);
              pointsEarned = pointsBreakdown.total;
              stats.calculatedPoints += pointsEarned;
            }

            stats.predictionsDetail.push({
              match: match ? `${match.team_a} vs ${match.team_b}` : `Match ID: ${p.game_id}`,
              phase: match ? match.phase : 'N/A',
              kickoff: match ? new Date(match.date) : null,
              submittedAt: createdTime,
              modifiedAt: modifiedTime,
              prediction: `${p.fulltime_a ?? '-'} - ${p.fulltime_b ?? '-'} (${p.winner_draw || 'N/A'})`,
              actualScore: match ? `${match.fulltime_a ?? '-'} - ${match.fulltime_b ?? '-'}` : 'N/A',
              calculatedPoints: pointsEarned,
              isLate: isLate,
              lateReason: lateReason,
              winner_draw: p.winner_draw,
              team_a: match?.team_a,
              team_b: match?.team_b,
              breakdown: pointsBreakdown
            });
          } else {
            stats.predictionsDetail.push({
              match: `Match ID: ${p.game_id}`,
              phase: 'N/A',
              kickoff: null,
              submittedAt: createdTime,
              modifiedAt: modifiedTime,
              prediction: `${p.fulltime_a ?? '-'} - ${p.fulltime_b ?? '-'} (${p.winner_draw || 'N/A'})`,
              actualScore: 'N/A',
              calculatedPoints: 0,
              isLate: isLate,
              lateReason: lateReason,
              winner_draw: p.winner_draw,
              team_a: undefined,
              team_b: undefined,
              breakdown: { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0 }
            });
          }
        });

        // Calculate avg goals predicted
        let totalGoals = 0;
        let validPredictions = 0;
        stats.predictionsDetail.forEach(detail => {
          const p = userPredictions.find(pred => pred.game_id && detail.match.includes(String(pred.game_id)));
          if (p) {
            const goalA = parseInt(p.fulltime_a, 10);
            const goalB = parseInt(p.fulltime_b, 10);
            if (!isNaN(goalA) && !isNaN(goalB)) {
              totalGoals += (goalA + goalB);
              validPredictions++;
            }
          }
        });
        stats.averageGoalsPredicted = validPredictions > 0 ? Number((totalGoals / validPredictions).toFixed(2)) : 0;

        // Discrepancy checks
        if (stats.calculatedPoints !== stats.directusPoints) {
          stats.pointDiscrepancy = true;
          this.totalDiscrepancies++;
        }

        // Chronological sort of completed predictions to build trend analytics
        const completed = stats.predictionsDetail
          .filter(d => d.kickoff && d.actualScore !== 'N/A')
          .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

        // 1. Form Guide (Last 5 matches)
        const last5 = completed.slice(-5);
        stats.formGuide = last5.map(d => {
          if (d.isLate) return '🔴'; // Late/Fraud is auto miss
          if (d.calculatedPoints === 0) return '🔴';
          
          // Exact score matches: fulltime points are correct
          const matchItem = this.matches.find(m => `${m.team_a} vs ${m.team_b}` === d.match);
          if (matchItem) {
            const targetPhase = matchItem.phase === 'Third Place' ? 'Final' : matchItem.phase;
            const rule = rulesList.find(r => r.game_type === 'pronostics' && r.phase === targetPhase);
            if (rule && d.calculatedPoints >= (Number(rule.winner_draw_points || 0) + Number(rule.fulltime_exact_points || 0))) {
              return '⭐'; // Exact score
            }
          }
          
          if (d.calculatedPoints === 1 && d.phase !== 'Group Stage' && d.phase !== 'Round of 32') {
            return '🟡'; // Consolation point
          }
          return '🟢'; // Correct winner
        });

        // 2. Points by phase
        stats.pointsByPhase = {};
        stats.predictionsDetail.forEach(d => {
          if (!stats.pointsByPhase[d.phase]) stats.pointsByPhase[d.phase] = 0;
          stats.pointsByPhase[d.phase] += d.calculatedPoints;
        });

        // 3. Predicted outcomes percentages
        let homeWins = 0, awayWins = 0, draws = 0;
        stats.predictionsDetail.forEach(d => {
          if (d.winner_draw === d.team_a) homeWins++;
          else if (d.winner_draw === d.team_b) awayWins++;
          else if (d.winner_draw === 'Draw') draws++;
        });
        const totalOutcomes = homeWins + awayWins + draws;
        stats.homePredictionsPct = totalOutcomes > 0 ? Math.round((homeWins / totalOutcomes) * 100) : 0;
        stats.awayPredictionsPct = totalOutcomes > 0 ? Math.round((awayWins / totalOutcomes) * 100) : 0;
        stats.drawPredictionsPct = totalOutcomes > 0 ? Math.round((draws / totalOutcomes) * 100) : 0;

        // 4. Submission Lead Time
        let totalMinutes = 0;
        let countLead = 0;
        stats.predictionsDetail.forEach(d => {
          if (d.kickoff && d.submittedAt) {
            const diffMs = d.kickoff.getTime() - d.submittedAt.getTime();
            const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
            totalMinutes += diffMinutes;
            countLead++;
          }
        });
        stats.averageLeadTimeMinutes = countLead > 0 ? Math.round(totalMinutes / countLead) : 0;
        stats.isCalculating = false;
      }

      index = limit;
      setTimeout(processNextChunk, 15);
    };

    processNextChunk();
  }

  calculatePoints(match: any, prediction: any, rules: any[]): any {
    const targetPhase = match.phase === 'Third Place' ? 'Final' : match.phase;
    const rule = rules.find(r => r.game_type === 'pronostics' && r.phase === targetPhase) || {
      winner_draw_points: 0,
      fulltime_exact_points: 0,
      halftime_exact_points: 0,
      scorer_points: 0,
      consolation_points: 0
    };

    const breakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0 };
    let accurateFieldsCount = 0;

    const getScore = (val: any) => (val === '-' || val === null || val === undefined || val === '') ? 0 : parseInt(val, 10);

    // 1. Inferred winner logic matching backend
    let inferredWinnerDraw = prediction.winner_draw;
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
    if (isHalftimeExact && Number(rule.halftime_exact_points) > 0) {
      breakdown.halftime = Number(rule.halftime_exact_points);
      accurateFieldsCount++;
    }
    
    // Scorer calculation with fuzzy string similarity
    if (prediction.scorer && Number(rule.scorer_points) > 0 && match.scorers) {
      let matchScorersList: string[] = [];
      if (typeof match.scorers === 'string') {
        try {
          const parsed = JSON.parse(match.scorers);
          if (Array.isArray(parsed)) {
            matchScorersList = parsed.map((s: any) => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || ''));
          } else {
            matchScorersList = [match.scorers];
          }
        } catch {
          matchScorersList = match.scorers.split(',').map((s: string) => s.trim());
        }
      } else if (Array.isArray(match.scorers)) {
        matchScorersList = match.scorers.map((s: any) => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || ''));
      }
      
      const normalizedProno = prediction.scorer.toLowerCase().trim().replace(/[\s-]/g, '');
      const hasMatched = matchScorersList.some((s: string) => {
        const norm = s.toLowerCase().trim().replace(/[\s-]/g, '');
        // Simple similarity fallback: prefix match or inclusion or levenshtein distance
        return norm.includes(normalizedProno) || normalizedProno.includes(norm);
      });
      if (hasMatched) {
        breakdown.scorer = Number(rule.scorer_points);
        accurateFieldsCount++;
      }
    }

    if (match.phase !== 'Group Stage' && match.phase !== 'Round of 32') {
      if (accurateFieldsCount === 0 && Number(rule.consolation_points) > 0) {
        breakdown.consolation = Number(rule.consolation_points);
      }
      breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;
      
      // Guaranteed minimum 1 point for late-stage knockout misses matching backend
      if (breakdown.total === 0) {
        breakdown.consolation = 1;
        breakdown.total = 1;
      }
    } else {
      breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer;
    }

    return breakdown;
  }

  getFilteredPlayers(): PlayerStats[] {
    if (!this.searchTerm.trim()) {
      return this.playersReport;
    }
    const term = this.searchTerm.toLowerCase();
    return this.playersReport.filter(p => 
      p.username.toLowerCase().includes(term) || 
      p.email.toLowerCase().includes(term)
    );
  }

  selectPlayer(player: PlayerStats): void {
    this.selectedPlayer = player;
  }

  closeDetails(): void {
    this.selectedPlayer = null;
  }
}
