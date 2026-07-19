import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { PredictionsApiService } from '../../../shared/services/api/predictions-api.service';
import { RulesApiService } from '../../../shared/services/api/rules-api.service';
import { AuthService } from '../../../shared/services/core/auth.service';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { RankingsService } from '../../../shared/services/content/rankings.service';
import { PronosticsRankingsApiService } from '../../../shared/services/api/pronostics-rankings-api.service';
import { forkJoin, of, timeout, interval, Subject } from 'rxjs';
import { catchError, map, tap, takeUntil } from 'rxjs/operators';

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
  private cdr = inject(ChangeDetectorRef);

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

  isGlobalAuditRun = false;
  isGlobalAuditing = false;

  private _searchTerm = '';
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(val: string) {
    this._searchTerm = val;
    this.currentPage = 1;
    this.calculatePageData();
  }

  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    const filteredCount = this.getFilteredPlayers().length;
    return Math.max(1, Math.ceil(filteredCount / this.pageSize));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.calculatePageData();
    }
  }

  getPaginatedPlayers(): PlayerStats[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.getFilteredPlayers().slice(startIndex, startIndex + this.pageSize);
  }

  isRecalculating = false;
  recalcSuccessMessage = '';
  showRecalcProgress = false;
  recalcLiveLines: string[] = [];

  recalcSummary: {
    matchesSynced: number;
    usersSaved: number;
    fraudDetected: number;
    duplicatesDetected: number;
    logs: string[];
    durationMs: number;
  } | null = null;

  /**
   * Estimated backend timeline — these messages mirror the actual sequence in
   * calc-rankings.mjs so the user sees meaningful progress while the single
   * HTTP call runs server-side (no streaming available).
   */
  private readonly RECALC_STEPS: { delayMs: number; text: string }[] = [
    { delayMs:    0, text: '🔌 Connexion à Directus avec le token admin...' },
    { delayMs:  800, text: '📥 Chargement de tous les matches, pronostics, classements et règles...' },
    { delayMs: 2500, text: '🔧 Sync règles → matches : mise à jour des champs winner_point / fulltime_point / halftime_point / scorer_point sur chaque match pour refléter les règles actuelles du barème...' },
    { delayMs: 5000, text: '🧮 Calcul des points par joueur (fraude, doublons, barème par phase)...' },
    { delayMs: 8000, text: '⚠️  Vérification des timestamps — invalidation des pronostics soumis ou modifiés après le coup d\'envoi...' },
    { delayMs:12000, text: '💾 Écriture des classements mis à jour dans pronostics_rankings...' },
    { delayMs:18000, text: '🧹 Nettoyage des entrées de joueurs sans pronostics actifs...' },
    { delayMs:24000, text: '⏳ Toujours en cours — attente de la réponse du serveur...' },
  ];

  ngOnInit(): void {
    this.loadAdminData();
  }

  recalculateDirectusPoints(): void {
    this.isRecalculating = true;
    this.recalcSuccessMessage = '';
    this.showRecalcProgress = true;
    this.recalcSummary = null;
    this.recalcLiveLines = ['🔌 Initialisation du recalcul par lots...'];
    const startTime = Date.now();
    const batchSize = 10;
    const allLogs: string[] = [];

    let totalMatchesSynced = 0;
    let totalUsersSaved = 0;
    let totalFraudDetected = 0;
    let totalDuplicatesDetected = 0;

    const executeBatch = (offset: number) => {
      this.recalcLiveLines = [...this.recalcLiveLines, `📦 Envoi du lot : offset ${offset}, taille ${batchSize}...`].slice(-8);
      this.cdr.detectChanges();

      this.rankingsService.recalculateRankings(offset, batchSize).subscribe({
        next: (res: any) => {
          const batchResult = res?.calculationLogs || {};
          const batchLogs = batchResult.logs || [];
          allLogs.push(...batchLogs);

          // Update aggregated counts
          totalMatchesSynced += batchLogs.filter((l: string) => l.startsWith('Synced points in Directus')).length;
          totalUsersSaved += batchLogs.filter((l: string) => l.startsWith('Saved row in Directus')).length;
          totalFraudDetected += batchLogs.filter((l: string) => l.includes('FRAUD DETECTED')).length;
          totalDuplicatesDetected += batchLogs.filter((l: string) => l.includes('DUPLICATE DETECTED')).length;

          if (batchResult.isDone || batchResult.nextOffset === undefined || batchResult.nextOffset >= batchResult.totalUsers) {
            // Done!
            const durationMs = Date.now() - startTime;
            this.recalcLiveLines = [];
            this.recalcSummary = {
              matchesSynced: totalMatchesSynced,
              usersSaved: totalUsersSaved,
              fraudDetected: totalFraudDetected,
              duplicatesDetected: totalDuplicatesDetected,
              logs: allLogs,
              durationMs
            };
            this.recalcSuccessMessage = 'Points recalculés avec succès dans Directus !';
            this.isRecalculating = false;
            this.loadAdminData();
            this.cdr.detectChanges();
            setTimeout(() => this.recalcSuccessMessage = '', 5000);
          } else {
            // Process next batch
            executeBatch(batchResult.nextOffset);
          }
        },
        error: (err) => {
          const durationMs = Date.now() - startTime;
          this.recalcLiveLines = [];
          this.recalcSummary = {
            matchesSynced: totalMatchesSynced,
            usersSaved: totalUsersSaved,
            fraudDetected: totalFraudDetected,
            duplicatesDetected: totalDuplicatesDetected,
            logs: [...allLogs, '❌ Erreur de traitement par lot : ' + (err.message || err)],
            durationMs
          };
          this.errorMessage = 'Erreur lors du recalcul des points : ' + (err.message || err);
          this.isRecalculating = false;
          this.cdr.detectChanges();
        }
      });
    };

    executeBatch(0);
  }

  loadAdminData(): void {
    console.log('[Admin] loadAdminData started');
    this.isLoading = true;
    this.errorMessage = '';
    this.isGlobalAuditRun = false;
    this.fraudCases = [];
    this.totalDiscrepancies = 0;
    const token = this.cookieService.get('currentToken');
    console.log('[Admin] token from cookies:', token ? 'exists (starts with ' + token.substring(0, 10) + '...)' : 'missing');

    if (!token) {
      this.errorMessage = 'Veuillez vous reconnecter (Token invalide/absent)';
      this.isLoading = false;
      return;
    }

    console.log('[Admin] Launching forkJoin requests...');
    // 1. Fetch Users, Rankings, Matches, and Rules first (extremely fast & cached)
    forkJoin({
      users: this.authService.getUsers(token).pipe(
        tap(() => console.log('[Admin] getUsers finished')),
        timeout(10000),
        catchError((err) => {
          console.error('[Admin] getUsers failed:', err);
          return of({ data: [] });
        })
      ),
      rankings: this.pronosticsRankingsApi.getRankings('?limit=-1', { headers: { 'Authorization': `Bearer ${token}` } }).pipe(
        tap(() => console.log('[Admin] getRankings finished')),
        timeout(10000),
        map(r => r?.data || r || []),
        catchError((err) => {
          console.error('[Admin] getRankings failed:', err);
          return of([]);
        })
      ),
      matches: this.matchesService.getAllMatches().pipe(
        tap(() => console.log('[Admin] getAllMatches finished')),
        timeout(15000),
        catchError((err) => {
          console.error('[Admin] getAllMatches failed:', err);
          return of([]);
        })
      ),
      rules: this.rulesApi.getScoringRules({ headers: { 'Authorization': `Bearer ${token}` } }).pipe(
        tap(() => console.log('[Admin] getScoringRules finished')),
        timeout(10000),
        catchError((err) => {
          console.error('[Admin] getScoringRules failed:', err);
          return of({ data: [] });
        })
      )
    }).subscribe({
      next: (res: any) => {
        try {
          console.log('[Admin] forkJoin next called. Response:', res);
          this.users = res.users?.data || res.users || [];
          this.rankings = res.rankings || [];
          this.matches = res.matches || [];
          this.rules = res.rules?.data || res.rules || [];

          console.log('[Admin] Data lengths - Users:', this.users.length, 'Rankings:', this.rankings.length, 'Matches:', this.matches.length, 'Rules:', this.rules.length);

          // Build player list: prefer users list, fall back to rankings if users is empty
          const sourceList = this.users.length > 0
            ? this.users.map((u: any) => ({
                username: u.first_name || u.last_name || u.email?.split('@')[0] || 'Inconnu',
                email: u.email || '',
              }))
            : this.rankings.map((r: any) => ({
                username: r.key || r.user || 'Inconnu',
                email: '',
              }));

          // Initialize players list immediately with Directus rankings
          this.playersReport = sourceList.map((u: any) => {
            const username = u.username;
            const key = username.toLowerCase().trim();
            const rankingObj = this.rankings.find((r: any) => (r.key || r.user || '').toLowerCase().trim() === key);
            
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

          if (this.playersReport.length === 0) {
            this.errorMessage = 'Aucun joueur trouvé dans la base de données.';
          }

          this.isLoading = false;
          console.log('[Admin] Initial loading completed successfully');
          this.cdr.detectChanges();
          
          // 2. Fetch and calculate only the active page's users
          this.calculatePageData();
        } catch (e) {
          console.error('[Admin] Exception in forkJoin next handler:', e);
          this.errorMessage = 'Exception lors de l\'initialisation : ' + e;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('[Admin] forkJoin error handler:', err);
        this.errorMessage = 'Erreur lors de l\'initialisation des données : ' + (err.message || err);
        this.isLoading = false;
      }
    });
  }

  calculatePageData(): void {
    try {
      console.log('[Admin] calculatePageData started');
      const visiblePlayers = this.getPaginatedPlayers();
      console.log('[Admin] Visible players on current page:', visiblePlayers.map(p => p.username));
      if (visiblePlayers.length === 0) {
        console.log('[Admin] No visible players on page');
        return;
      }

      // Filter out users already calculated
      const playersToFetch = visiblePlayers.filter(p => p.isCalculating);
      console.log('[Admin] Players to fetch predictions for:', playersToFetch.map(p => p.username));
      if (playersToFetch.length === 0) {
        console.log('[Admin] All visible players already calculated');
        return;
      }

      const token = this.cookieService.get('currentToken');
      if (!token) {
        console.warn('[Admin] No currentToken available for predictions fetch');
        return;
      }

      const httpOptions = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      // Build filter string to fetch predictions ONLY for visible page users
      // Directus filter syntax: filter[user][_in]=username1,username2...
      const usernames = playersToFetch.map(p => p.username.toLowerCase().trim()).join(',');
      const predictionsUrl = `?limit=-1&fields=id,user,game_id,fulltime_a,fulltime_b,winner_draw,scorer,created_on,modified_on&filter[fulltime_a][nnull]&filter[user][in]=${usernames}`;

      console.log('[Admin] Fetching predictions with URL:', predictionsUrl);
      this.predictionsApi.getPredictions(predictionsUrl, httpOptions).pipe(
        timeout(15000),
        catchError((err) => {
          console.error('[Admin] getPredictions API request failed:', err);
          return of({ data: [] });
        })
      ).subscribe({
        next: (res: any) => {
          try {
            console.log('[Admin] getPredictions response received:', res);
            const pagePredictions = res?.data || res || [];
            console.log('[Admin] Page predictions count:', pagePredictions.length);
            
            // Group predictions by user
            const predictionsByUser = new Map<string, any[]>();
            pagePredictions.forEach((p: any) => {
              if (!p.user) return;
              const key = p.user.toLowerCase().trim();
              if (!predictionsByUser.has(key)) {
                predictionsByUser.set(key, []);
              }
              predictionsByUser.get(key)!.push(p);
            });

            playersToFetch.forEach(stats => {
              const userKey = stats.username.toLowerCase().trim();
              const userPredictions = predictionsByUser.get(userKey) || [];
              console.log('[Admin] Processing user:', stats.username, 'Predictions count:', userPredictions.length);

              stats.totalPredictions = 0;
              stats.modifiedCount = 0;
              stats.predictionsDetail = [];
              stats.formGuide = [];
              stats.pointsByPhase = {};
              stats.averageGoalsPredicted = 0;
              stats.homePredictionsPct = 0;
              stats.awayPredictionsPct = 0;
              stats.drawPredictionsPct = 0;
              stats.averageLeadTimeMinutes = 0;

              let totalLeadTimeMinutes = 0;
              let homeWins = 0, awayWins = 0, draws = 0;
              let totalGoalsPredicted = 0;
              let calculatedPoints = 0;
              let hasFraud = false;
              const recentMatches: any[] = [];

              userPredictions.forEach(p => {
                stats.totalPredictions++;

                const createdTime = p.created_on ? new Date(p.created_on) : null;
                const modifiedTime = p.modified_on ? new Date(p.modified_on) : null;
                if (createdTime && modifiedTime && Math.abs(modifiedTime.getTime() - createdTime.getTime()) > 5000) {
                  stats.modifiedCount++;
                }

                const match = this.matches.find(m => String(m.id) === String(p.game_id));
                if (match) {
                  const kickoffTime = new Date(match.date);
                  let isLate = false;
                  if (createdTime && createdTime > kickoffTime) {
                    isLate = true;
                  } else if (modifiedTime && modifiedTime > kickoffTime) {
                    isLate = true;
                  }

                  if (isLate) {
                    hasFraud = true;
                    // Add to visible fraud cases if not already present
                    if (!this.fraudCases.some(f => f.user === stats.username && f.matchId === match.id)) {
                      this.fraudCases.push({
                        user: stats.username,
                        matchId: match.id,
                        matchName: `${match.team_a} vs ${match.team_b}`,
                        kickoff: kickoffTime,
                        submittedAt: createdTime,
                        modifiedAt: modifiedTime,
                        reason: createdTime && createdTime > kickoffTime ? 'Création après coup d\'envoi' : 'Modification après coup d\'envoi'
                      });
                    }
                  }

                  if (createdTime) {
                    const diffMs = kickoffTime.getTime() - createdTime.getTime();
                    totalLeadTimeMinutes += Math.max(0, Math.floor(diffMs / 60000));
                  }

                  // Count goals predicted
                  const pScoreA = p.fulltime_a !== null ? Number(p.fulltime_a) : 0;
                  const pScoreB = p.fulltime_b !== null ? Number(p.fulltime_b) : 0;
                  totalGoalsPredicted += (pScoreA + pScoreB);

                  // Outcomes selection
                  if (p.winner_draw === match.team_a) homeWins++;
                  else if (p.winner_draw === match.team_b) awayWins++;
                  else if (p.winner_draw === 'Draw') draws++;

                  let pointsEarned = 0;
                  let breakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0 };

                  if (!isLate && match.fulltime_a !== null && match.fulltime_b !== null) {
                    breakdown = this.calculatePoints(match, p, this.rules);
                    pointsEarned = breakdown.total;
                    calculatedPoints += pointsEarned;

                    const phaseName = match.phase || 'Groupe';
                    stats.pointsByPhase[phaseName] = (stats.pointsByPhase[phaseName] || 0) + pointsEarned;
                  }

                  // Build detail object
                  stats.predictionsDetail.push({
                    match: `${match.team_a} vs ${match.team_b}`,
                    phase: match.phase || 'Groupe',
                    kickoff: kickoffTime,
                    submittedAt: createdTime,
                    modifiedAt: modifiedTime,
                    prediction: `${p.fulltime_a ?? '-'} - ${p.fulltime_b ?? '-'} (${p.winner_draw || 'N/A'})`,
                    actualScore: match.fulltime_a !== null ? `${match.fulltime_a} - ${match.fulltime_b}` : 'À venir',
                    calculatedPoints: isLate ? 0 : pointsEarned,
                    isLate: isLate,
                    breakdown: breakdown,
                    winner_draw: p.winner_draw,
                    team_a: match.team_a,
                    team_b: match.team_b
                  });

                  if (match.fulltime_a !== null && match.fulltime_b !== null) {
                    recentMatches.push({
                      date: kickoffTime,
                      points: pointsEarned,
                      breakdown: breakdown
                    });
                  }
                }
              });

              // Form guide: sort recent played matches and take last 5
              recentMatches.sort((a, b) => b.date.getTime() - a.date.getTime());
              stats.formGuide = recentMatches.slice(0, 5).reverse().map(m => {
                if (m.breakdown.fulltime > 0) return '⭐';
                if (m.breakdown.winner > 0) return '🟢';
                if (m.breakdown.consolation > 0) return '🟡';
                return '🔴';
              });

              // Averages
              if (stats.totalPredictions > 0) {
                stats.averageGoalsPredicted = totalGoalsPredicted / stats.totalPredictions;
                stats.homePredictionsPct = (homeWins / stats.totalPredictions) * 100;
                stats.awayPredictionsPct = (awayWins / stats.totalPredictions) * 100;
                stats.drawPredictionsPct = (draws / stats.totalPredictions) * 100;
                stats.averageLeadTimeMinutes = totalLeadTimeMinutes / stats.totalPredictions;
              }

              stats.calculatedPoints = calculatedPoints;
              stats.pointDiscrepancy = stats.directusPoints !== stats.calculatedPoints;
              stats.hasFraud = hasFraud;

              stats.isCalculating = false; // Complete calculation for this user
              console.log('[Admin] User finished calculation successfully:', stats.username);
            });
            this.cdr.detectChanges();
          } catch (e) {
            console.error('[Admin] Exception in getPredictions next handler:', e);
          }
        }
      });
    } catch (e) {
      console.error('[Admin] Exception in calculatePageData:', e);
      this.errorMessage = 'Erreur lors du calcul des pages : ' + e;
      this.isLoading = false;
    }
  }

  runFullAudit(): void {
    this.isGlobalAuditing = true;
    this.errorMessage = '';
    const token = this.cookieService.get('currentToken');

    if (!token) {
      this.isGlobalAuditing = false;
      return;
    }

    const httpOptions = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    // Load ALL predictions for full audit
    this.predictionsApi.getPredictions('?limit=-1&fields=id,user,game_id,fulltime_a,fulltime_b,winner_draw,scorer,created_on,modified_on&filter[fulltime_a][nnull]', httpOptions).pipe(
      timeout(30000),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (res: any) => {
        this.predictions = res?.data || res || [];
        this.fraudCases = [];
        this.totalDiscrepancies = 0;

        // Group predictions by user for O(1) checks
        const predictionsByUser = new Map<string, any[]>();
        this.predictions.forEach(p => {
          if (!p.user) return;
          const key = p.user.toLowerCase().trim();
          if (!predictionsByUser.has(key)) {
            predictionsByUser.set(key, []);
          }
          predictionsByUser.get(key)!.push(p);
        });

        // Loop through all players to compute audits
        this.playersReport.forEach(stats => {
          const userKey = stats.username.toLowerCase().trim();
          const userPredictions = predictionsByUser.get(userKey) || [];

          let calculatedPoints = 0;
          let hasFraud = false;

          userPredictions.forEach(p => {
            const createdTime = p.created_on ? new Date(p.created_on) : null;
            const modifiedTime = p.modified_on ? new Date(p.modified_on) : null;
            const match = this.matches.find(m => String(m.id) === String(p.game_id));

            if (match) {
              const kickoffTime = new Date(match.date);
              let isLate = false;
              if (createdTime && createdTime > kickoffTime) {
                isLate = true;
              } else if (modifiedTime && modifiedTime > kickoffTime) {
                isLate = true;
              }

              if (isLate) {
                hasFraud = true;
                this.fraudCases.push({
                  user: stats.username,
                  matchId: match.id,
                  matchName: `${match.team_a} vs ${match.team_b}`,
                  kickoff: kickoffTime,
                  submittedAt: createdTime,
                  modifiedAt: modifiedTime,
                  reason: createdTime && createdTime > kickoffTime ? 'Création après coup d\'envoi' : 'Modification après coup d\'envoi'
                });
              }

              if (!isLate && match.fulltime_a !== null && match.fulltime_b !== null) {
                const breakdown = this.calculatePoints(match, p, this.rules);
                calculatedPoints += breakdown.total;
              }
            }
          });

          stats.calculatedPoints = calculatedPoints;
          stats.pointDiscrepancy = stats.directusPoints !== stats.calculatedPoints;
          stats.hasFraud = hasFraud;
          if (stats.pointDiscrepancy) {
            this.totalDiscrepancies++;
          }
          stats.isCalculating = false;
        });

        // Trigger visible page detailed calculations just to build remaining analytics
        this.calculatePageData();

        this.isGlobalAuditRun = true;
        this.isGlobalAuditing = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement de l\'audit complet : ' + (err.message || err);
        this.isGlobalAuditing = false;
      }
    });
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
