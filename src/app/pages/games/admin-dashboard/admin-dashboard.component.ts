import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule, Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { PredictionsApiService } from '../../../shared/services/api/predictions-api.service';
import { MatchesApiService } from '../../../shared/services/api/matches-api.service';
import { RulesApiService } from '../../../shared/services/api/rules-api.service';
import { AuthService } from '../../../shared/services/core/auth.service';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { RankingsService } from '../../../shared/services/content/rankings.service';
import { PronosticsRankingsApiService } from '../../../shared/services/api/pronostics-rankings-api.service';
import { PointsCalculatorService } from '../../../shared/services/games/points-calculator.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, forkJoin, of, timeout, interval, Subject } from 'rxjs';
import { catchError, map, tap, takeUntil } from 'rxjs/operators';
import { Matches } from '../../../shared/contracts/matches.contract';

interface FraudReport {
  user: string;
  matchId: number;
  matchName: string;
  kickoff: Date;
  submittedAt: Date | null;
  modifiedAt: Date | null;
  reason: string;
  predictionId: string | number;
}

interface HalftimeAnomalyReport extends FraudReport {
  fulltime_a: any;
  fulltime_b: any;
  halftime_a: any;
  halftime_b: any;
  winner_draw: any;
  matchHalftimeFlag: boolean;
  pointsAwarded: number;
  halftimePointsAwarded: number;
  directusFulltimePoints: number;
  recalculatedFulltimePoints: number;
  recalculatedHalftimePoints: number;
  recalculatedTotalPoints: number;
  hasDiscrepancy: boolean;
  discrepancyText?: string;
}

interface UserAnomalyGroup {
  username: string;
  totalAnomalies: number;
  totalPointsAwarded: number;
  totalFulltimePointsAwarded: number;
  totalHalftimePointsAwarded: number;
  cases: HalftimeAnomalyReport[];
  isExpanded?: boolean;
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
  imports: [CommonModule, FormsModule, TabsModule, Tabs, TabList, Tab, TabPanels, TabPanel],
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
  private predictionsApiService = inject(PredictionsApiService);
  private matchesApiService = inject(MatchesApiService);
  private pronosticsRankingsApi = inject(PronosticsRankingsApiService);
  private cdr = inject(ChangeDetectorRef);
  private pointsCalculatorService = inject(PointsCalculatorService);
  private http = inject(HttpClient);

  alertDialog: { title: string; message: string; isError?: boolean; logs?: string[] } | null = null;
  confirmDialog: { title: string; message: string; onConfirm: () => void } | null = null;

  isLoading = true;
  errorMessage = '';

  matches: any[] = [];
  predictions: any[] = [];
  rules: any[] = [];
  wccPlayers: any[] = [];
  users: any[] = [];
  rankings: any[] = [];

  playersReport: PlayerStats[] = [];
  fraudCases: FraudReport[] = [];
  duplicateCases: FraudReport[] = [];
  incompleteScoreCases: HalftimeAnomalyReport[] = [];
  groupedScoreAnomalies: UserAnomalyGroup[] = [];
  totalDiscrepancies = 0;

  isNullOrEmptyOrDash(val: any): boolean {
    if (val === null || val === undefined) return true;
    const s = String(val).trim();
    return s === '' || s === '-' || s === 'null' || s === 'undefined';
  }

  toggleUserAnomalyGroup(group: UserAnomalyGroup): void {
    group.isExpanded = !group.isExpanded;
  }

  selectedPlayer: PlayerStats | null = null;

  isGlobalAuditRun = false;
  isGlobalAuditing = false;

  // Revisions Modal State
  selectedRevisionPrediction: FraudReport | null = null;
  selectedRevisions: any[] = [];
  isLoadingRevisions = false;
  revisionsError = '';

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
  activeTab: string = 'summary';

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
    { delayMs: 0, text: '🔌 Connexion à Directus avec le token admin...' },
    { delayMs: 800, text: '📥 Chargement de tous les matches, pronostics, classements et règles...' },
    { delayMs: 2500, text: '🔧 Sync règles → matches : mise à jour des champs winner_point / fulltime_point / halftime_point / scorer_point sur chaque match pour refléter les règles actuelles du barème...' },
    { delayMs: 5000, text: '🧮 Calcul des points par joueur (fraude, doublons, barème par phase)...' },
    { delayMs: 8000, text: '⚠️  Vérification des timestamps — invalidation des pronostics soumis ou modifiés après le coup d\'envoi...' },
    { delayMs: 12000, text: '💾 Écriture des classements mis à jour dans pronostics_rankings...' },
    { delayMs: 18000, text: '🧹 Nettoyage des entrées de joueurs sans pronostics actifs...' },
    { delayMs: 24000, text: '⏳ Toujours en cours — attente de la réponse du serveur...' },
  ];

  private syncInterval: any;

  ngOnInit(): void {
    this.loadAdminData();
    this.loadWccPlayers();
    this.checkBackgroundRecalc();
  }

  @ViewChild('liveLogBody') liveLogBody!: ElementRef;

  ngOnDestroy(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  @ViewChild('summaryLogBody') summaryLogBody!: ElementRef;

  private tryDetectChanges() {
    try {
      this.cdr.detectChanges();
      setTimeout(() => {
        if (this.liveLogBody?.nativeElement) {
          this.liveLogBody.nativeElement.scrollTop = this.liveLogBody.nativeElement.scrollHeight;
        }
        if (this.summaryLogBody?.nativeElement) {
          this.summaryLogBody.nativeElement.scrollTop = this.summaryLogBody.nativeElement.scrollHeight;
        }
      }, 150);
    } catch (e) {
      // Ignore ViewDestroyedError
    }
  }

  loadWccPlayers() {
    this.http.get<any>(`${environment.apiBaseUrl}/items/wcc_players?limit=-1`).subscribe({
      next: (res) => {
        this.wccPlayers = res.data || [];
        this.playersByTeamCache = {}; // clear cache
        if (this.matches && this.matches.length > 0) {
          this.calculateMissingScorersList();
        }
      },
      error: (err) => console.error('Failed to load wcc_players', err)
    });
  }

  checkBackgroundRecalc() {
    const checkState = () => {
      const saved = localStorage.getItem('recalc_bg_state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          if (state.isRunning) {
            const now = Date.now();
            if (now - state.lastTick > 60000) {
              state.isRunning = false;
              state.errorMessage = 'La tâche a été interrompue (fermeture du navigateur ou délai expiré).';
              localStorage.setItem('recalc_bg_state', JSON.stringify(state));
            }
          }

          if (state.isRunning || state.recalcSummary || state.errorMessage) {
            // Only update UI if we are polling from another instance OR finishing
            // Don't overwrite if WE are the active running instance
            if (!this.isRecalculating || state.errorMessage || state.recalcSummary) {
              this.isRecalculating = state.isRunning;
              if (this.isRecalculating) {
                this.showRecalcProgress = true;
              }
              this.recalcLiveLines = state.recalcLiveLines || [];
              this.recalcSummary = state.recalcSummary || null;
              this.recalcSuccessMessage = state.recalcSuccessMessage || '';
              if (state.errorMessage) {
                this.errorMessage = state.errorMessage;
                this.showRecalcProgress = false;
              }
              this.tryDetectChanges();
            }
            if (!state.isRunning && this.syncInterval) {
              clearInterval(this.syncInterval);
              this.syncInterval = null;
              this.loadAdminData(true);
            }
          }
        } catch (e) { }
      }
    };
    checkState();
    this.syncInterval = setInterval(checkState, 1500);
  }

  recalculateDirectusPoints(forceUpdate: boolean = false): void {
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

    const saveState = (isRunning: boolean) => {
      localStorage.setItem('recalc_bg_state', JSON.stringify({
        isRunning,
        recalcLiveLines: this.recalcLiveLines,
        recalcSummary: this.recalcSummary,
        recalcSuccessMessage: this.recalcSuccessMessage,
        errorMessage: this.errorMessage,
        lastTick: Date.now()
      }));
    };

    const executeBatch = (offset: number) => {
      this.recalcLiveLines = [...this.recalcLiveLines, `👤 Calcul du joueur ${offset + 1}...`].slice(-8);
      saveState(true);
      this.tryDetectChanges();

      this.rankingsService.recalculateRankings(offset, batchSize, null, forceUpdate).subscribe({
        next: (res: any) => {
          const batchResult = res?.calculationLogs || {};
          const batchLogs = batchResult.logs || [];
          allLogs.push(...batchLogs);

          if (batchResult.processedUsers && batchResult.processedUsers.length > 0) {
            const trigrammes = batchResult.processedUsers.join(', ');
            this.recalcLiveLines[this.recalcLiveLines.length - 1] = `👤 Calcul du joueur ${offset + 1} (${trigrammes})... terminé.`;
            saveState(true);
            this.tryDetectChanges();
          }

          // Update aggregated counts
          totalMatchesSynced += batchLogs.filter((l: string) => l.startsWith('Synced points in Directus')).length;
          totalUsersSaved += batchLogs.filter((l: string) => l.startsWith('Saved row in Directus')).length;
          totalFraudDetected += batchLogs.filter((l: string) => l.includes('FRAUD DETECTED')).length;
          totalDuplicatesDetected += batchLogs.filter((l: string) => l.includes('DUPLICATE DETECTED')).length;

          if (batchResult.isDone || batchResult.nextOffset === undefined || batchResult.nextOffset >= batchResult.totalUsers) {
            // Done with points! Now force a full rank recalculation
            this.recalcLiveLines = [...this.recalcLiveLines, '🏆 Lancement du recalcul global des rangs...'].slice(-8);
            saveState(true);
            this.tryDetectChanges();

            this.rankingsService.recalculateRanksOnly().subscribe({
              next: () => {
                const durationMs = Date.now() - startTime;
                allLogs.push('✅ Rangs globaux recalculés avec succès.');
                this.recalcLiveLines = [];
                this.recalcSummary = {
                  matchesSynced: totalMatchesSynced,
                  usersSaved: totalUsersSaved,
                  fraudDetected: totalFraudDetected,
                  duplicatesDetected: totalDuplicatesDetected,
                  logs: allLogs,
                  durationMs
                };
                this.recalcSuccessMessage = 'Points et rangs recalculés avec succès !';
                this.isRecalculating = false;
                saveState(false);
                this.tryDetectChanges();
                setTimeout(() => {
                  this.loadAdminData();
                  this.tryDetectChanges();
                }, 3000);
                setTimeout(() => { this.recalcSuccessMessage = ''; saveState(false); }, 6000);
              },
              error: (err) => {
                const durationMs = Date.now() - startTime;
                allLogs.push('❌ Erreur lors du recalcul des rangs : ' + (err.message || err));
                this.recalcLiveLines = [];
                this.recalcSummary = {
                  matchesSynced: totalMatchesSynced,
                  usersSaved: totalUsersSaved,
                  fraudDetected: totalFraudDetected,
                  duplicatesDetected: totalDuplicatesDetected,
                  logs: allLogs,
                  durationMs
                };
                this.errorMessage = 'Erreur lors du recalcul des rangs : ' + (err.message || err);
                this.isRecalculating = false;
                saveState(false);
                this.tryDetectChanges();
              }
            });
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
          saveState(false);
          this.tryDetectChanges();
        }
      });
    };

    executeBatch(0);
  }

  recalculateSinglePlayer(player: PlayerStats): void {
    player.isCalculating = true;
    this.isRecalculating = true;
    this.recalcSuccessMessage = '';
    this.showRecalcProgress = true;
    this.recalcSummary = null;
    this.recalcLiveLines = [`👤 Lancement recalcul individuel pour ${player.username}...`];
    localStorage.removeItem('recalc_bg_state'); // Clear background state to prevent poller interference
    this.tryDetectChanges();

    this.rankingsService.recalculateRankings(0, 1, player.username, true).subscribe({
      next: (res: any) => {
        player.isCalculating = false;
        this.isRecalculating = false;
        this.recalcSuccessMessage = `Points recalculés avec succès pour ${player.username} !`;

        // Populate summary to show the logs in the modal
        this.recalcSummary = {
          matchesSynced: 0,
          usersSaved: 1,
          fraudDetected: 0,
          duplicatesDetected: 0,
          logs: res.calculationLogs?.logs || [res.message || 'Succès'],
          durationMs: 0
        };

        // Update the UI via reload to get the REAL points from the backend
        setTimeout(() => {
          this.loadAdminData(true);
          this.tryDetectChanges();
        }, 1500);
        setTimeout(() => this.recalcSuccessMessage = '', 6000);
      },
      error: (err) => {
        player.isCalculating = false;
        this.isRecalculating = false;
        this.errorMessage = `Erreur lors du recalcul pour ${player.username} : ` + (err.message || err);
        this.tryDetectChanges();
      }
    });
  }

  refreshPlayerLocal(player: PlayerStats): void {
    player.isCalculating = true;
    this.tryDetectChanges();
    // This will fetch their latest predictions and recalculate local points and fraud status
    this.calculatePageData();
  }

  forcePointsToDirectus(player: PlayerStats): void {
    this.confirmDialog = {
      title: 'Forcer la sauvegarde',
      message: `Voulez-vous vraiment forcer la sauvegarde de ${player.calculatedPoints} points pour ${player.username} dans Directus ?\n\n(Cela écrasera la valeur existante sans recalculer. Si le joueur n'existe pas, il sera créé.)`,
      onConfirm: () => {
        this.confirmDialog = null;
        this.rankingsService.forcePoints(player.username, player.calculatedPoints).subscribe({
          next: (res: any) => {
            this.alertDialog = { title: 'Succès', message: res.message };

            // Update the UI instantly
            if (player.pointDiscrepancy && !player.hasFraud) {
              this.totalDiscrepancies = Math.max(0, this.totalDiscrepancies - 1);
            }
            player.directusPoints = player.calculatedPoints;
            player.pointDiscrepancy = false;
            this.tryDetectChanges();
          },
          error: (err) => {
            this.alertDialog = { title: 'Erreur', message: err.error?.error || err.message, isError: true };
            this.tryDetectChanges();
          }
        });
      }
    };
  }

  recalculateRanksOnly(): void {
    this.confirmDialog = {
      title: 'Recalculer les rangs',
      message: 'Voulez-vous lancer le recalcul uniquement pour les rangs (sans modifier les points) ?',
      onConfirm: () => {
        this.confirmDialog = null;
        this.rankingsService.recalculateRanksOnly().subscribe({
          next: (res: any) => {
            this.alertDialog = { title: 'Succès', message: res.message };
            setTimeout(() => {
              this.loadAdminData(true);
              this.tryDetectChanges();
            }, 3000);
          },
          error: (err) => {
            this.alertDialog = { title: 'Erreur', message: err.error?.error || err.message, isError: true };
          }
        });
      }
    };
  }

  recalculateAllPlayers(): void {
    const playersWithEcart = this.playersReport.filter(p => p.pointDiscrepancy);

    if (playersWithEcart.length === 0) {
      this.confirmDialog = {
        title: 'Recalcul des rangs',
        message: 'Aucun écart détecté. Voulez-vous lancer le recalcul des rangs uniquement ?',
        onConfirm: () => {
          this.confirmDialog = null;
          this.recalculateRanksOnlyAction();
        }
      };
      return;
    }

    this.confirmDialog = {
      title: 'Mise à jour des écarts',
      message: `Voulez-vous forcer la mise à jour de ${playersWithEcart.length} joueur(s) ayant un écart de points avec la valeur calculée localement, puis relancer le recalcul des rangs ?`,
      onConfirm: () => {
        this.confirmDialog = null;
        this.isRecalculating = true;
        this.showRecalcProgress = true;
        this.recalcSummary = null;
        this.recalcLiveLines = [`Mise à jour de ${playersWithEcart.length} joueur(s)...`];
        this.tryDetectChanges();

        const observables = playersWithEcart.map(p => this.rankingsService.forcePoints(p.username, p.calculatedPoints));

        forkJoin(observables).subscribe({
          next: () => {
            this.recalcLiveLines.push('✅ Mise à jour des points terminée.');
            this.recalcLiveLines.push('🔄 Lancement du recalcul des rangs...');
            this.tryDetectChanges();

            this.rankingsService.recalculateRanksOnly().subscribe({
              next: (res: any) => {
                this.isRecalculating = false;
                this.recalcSuccessMessage = res.message || 'Recalcul terminé avec succès !';
                setTimeout(() => {
                  this.loadAdminData(true);
                  this.tryDetectChanges();
                }, 3000);
              },
              error: (err) => {
                this.isRecalculating = false;
                this.errorMessage = 'Erreur lors du recalcul des rangs: ' + (err.error?.error || err.message);
                this.tryDetectChanges();
              }
            });
          },
          error: (err) => {
            this.isRecalculating = false;
            this.errorMessage = 'Erreur lors de la mise à jour des points: ' + (err.error?.error || err.message);
            this.tryDetectChanges();
          }
        });
      }
    };
  }

  fixPredictionEcart(c: HalftimeAnomalyReport): void {
    this.confirmDialog = {
      title: 'Correction dans pronostics_rankings',
      message: `Voulez-vous corriger les points de #${c.matchId} pour ${c.user} uniquement dans la collection pronostics_rankings (passer à ${c.recalculatedTotalPoints} pts) ?`,
      onConfirm: () => {
        this.confirmDialog = null;
        this.isRecalculating = true;
        const token = this.cookieService.get('currentToken');
        const headers = { 'Authorization': `Bearer ${token}` };

        const userKey = c.user.toLowerCase().trim();
        const rankingRow = this.rankings.find((r: any) => (r.key || r.user || '').toLowerCase().trim() === userKey);

        if (!rankingRow) {
          this.isRecalculating = false;
          this.errorMessage = `Enregistrement pronostics_rankings introuvable pour le joueur ${c.user}`;
          return;
        }

        const pronostiquesList = rankingRow.pronostiques || [];
        const targetItem = pronostiquesList.find((pr: any) => String(pr.id) === String(c.predictionId) || String(pr.game_id) === String(c.matchId));

        if (targetItem) {
          targetItem.fulltime_a = this.isNullOrEmptyOrDash(c.fulltime_a) ? 0 : Number(c.fulltime_a);
          targetItem.fulltime_b = this.isNullOrEmptyOrDash(c.fulltime_b) ? 0 : Number(c.fulltime_b);
          targetItem.halftime_a = this.isNullOrEmptyOrDash(c.halftime_a) ? 0 : Number(c.halftime_a);
          targetItem.halftime_b = this.isNullOrEmptyOrDash(c.halftime_b) ? 0 : Number(c.halftime_b);
          targetItem.breakdown = {
            winner: Math.max(0, c.recalculatedTotalPoints - c.recalculatedFulltimePoints - c.recalculatedHalftimePoints),
            fulltime: c.recalculatedFulltimePoints,
            halftime: c.recalculatedHalftimePoints,
            scorer: targetItem.breakdown?.scorer || 0,
            consolation: 0,
            total: c.recalculatedTotalPoints
          };
          targetItem.points = c.recalculatedTotalPoints;
        }

        const totalPoints = pronostiquesList.reduce((sum: number, p: any) => sum + (p.breakdown?.total !== undefined ? Number(p.breakdown.total) : Number(p.points || 0)), 0);

        this.pronosticsRankingsApi.updateRanking(rankingRow.id, {
          pronostiques: pronostiquesList,
          point: totalPoints
        }, { headers }).subscribe({
          next: () => {
            this.isRecalculating = false;
            this.recalcSuccessMessage = `Mise à jour réussie dans pronostics_rankings pour #${c.matchId} (${c.user}) !`;
            this.loadAdminData(true);
          },
          error: (err) => {
            this.isRecalculating = false;
            this.errorMessage = `Erreur de mise à jour dans pronostics_rankings: ${err.error?.error || err.message}`;
          }
        });
      }
    };
  }

  fixAllDiscrepancies(): void {
    if (this.incompleteScoreCases.length === 0) return;
    this.confirmDialog = {
      title: 'Correction globale dans pronostics_rankings',
      message: `Voulez-vous corriger TOUS les ${this.incompleteScoreCases.length} écarts uniquement dans la collection pronostics_rankings ?`,
      onConfirm: () => {
        this.confirmDialog = null;
        this.isRecalculating = true;
        const token = this.cookieService.get('currentToken');
        const headers = { 'Authorization': `Bearer ${token}` };

        const casesByUser = new Map<string, HalftimeAnomalyReport[]>();
        this.incompleteScoreCases.forEach(c => {
          const key = c.user.toLowerCase().trim();
          if (!casesByUser.has(key)) casesByUser.set(key, []);
          casesByUser.get(key)!.push(c);
        });

        const updateObservables: Observable<any>[] = [];

        casesByUser.forEach((userCases, key) => {
          const rankingRow = this.rankings.find((r: any) => (r.key || r.user || '').toLowerCase().trim() === key);
          if (rankingRow) {
            const pronostiquesList = rankingRow.pronostiques || [];
            userCases.forEach(c => {
              const targetItem = pronostiquesList.find((pr: any) => String(pr.id) === String(c.predictionId) || String(pr.game_id) === String(c.matchId));
              if (targetItem) {
                targetItem.fulltime_a = this.isNullOrEmptyOrDash(c.fulltime_a) ? 0 : Number(c.fulltime_a);
                targetItem.fulltime_b = this.isNullOrEmptyOrDash(c.fulltime_b) ? 0 : Number(c.fulltime_b);
                targetItem.halftime_a = this.isNullOrEmptyOrDash(c.halftime_a) ? 0 : Number(c.halftime_a);
                targetItem.halftime_b = this.isNullOrEmptyOrDash(c.halftime_b) ? 0 : Number(c.halftime_b);
                targetItem.breakdown = {
                  winner: Math.max(0, c.recalculatedTotalPoints - c.recalculatedFulltimePoints - c.recalculatedHalftimePoints),
                  fulltime: c.recalculatedFulltimePoints,
                  halftime: c.recalculatedHalftimePoints,
                  scorer: targetItem.breakdown?.scorer || 0,
                  consolation: 0,
                  total: c.recalculatedTotalPoints
                };
                targetItem.points = c.recalculatedTotalPoints;
              }
            });
            const totalPoints = pronostiquesList.reduce((sum: number, p: any) => sum + (p.breakdown?.total !== undefined ? Number(p.breakdown.total) : Number(p.points || 0)), 0);

            updateObservables.push(this.pronosticsRankingsApi.updateRanking(rankingRow.id, {
              pronostiques: pronostiquesList,
              point: totalPoints
            }, { headers }));
          }
        });

        if (updateObservables.length === 0) {
          this.isRecalculating = false;
          return;
        }

        forkJoin(updateObservables).subscribe({
          next: () => {
            this.isRecalculating = false;
            this.recalcSuccessMessage = `Tous les écarts (${this.incompleteScoreCases.length}) ont été corrigés avec succès dans pronostics_rankings !`;
            this.loadAdminData(true);
          },
          error: (err) => {
            this.isRecalculating = false;
            this.errorMessage = `Erreur lors de la mise à jour dans pronostics_rankings: ${err.error?.error || err.message}`;
          }
        });
      }
    };
  }

  private recalculateRanksOnlyAction(): void {
    this.isRecalculating = true;
    this.rankingsService.recalculateRanksOnly().subscribe({
      next: (res: any) => {
        this.isRecalculating = false;
        this.recalcSuccessMessage = res.message || 'Recalcul terminé avec succès !';
        setTimeout(() => {
          this.loadAdminData(true);
          this.tryDetectChanges();
        }, 3000);
      },
      error: (err) => {
        this.isRecalculating = false;
        this.errorMessage = 'Erreur: ' + (err.error?.error || err.message);
        this.tryDetectChanges();
      }
    });
  }

  loadAdminData(silent: boolean = false): void {
    console.log('[Admin] loadAdminData started');
    if (!silent) this.isLoading = true;
    this.errorMessage = '';
    this.isGlobalAuditRun = false;
    this.fraudCases = [];
    this.duplicateCases = [];
    this.incompleteScoreCases = [];
    this.groupedScoreAnomalies = [];
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
      rankings: this.pronosticsRankingsApi.getRankings(`?limit=-1&fields=*,pronostiques.*&_=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } }).pipe(
        tap(() => console.log('[Admin] getRankings finished')),
        timeout(10000),
        map(r => r?.data || r || []),
        catchError((err) => {
          console.error('[Admin] getRankings failed:', err);
          return of([]);
        })
      ),
      matches: this.matchesService.getAllMatches(`?limit=-1&_=${Date.now()}`).pipe(
        tap(() => console.log('[Admin] getAllMatches finished')),
        timeout(15000),
        catchError((err) => {
          console.error('[Admin] getAllMatches failed:', err);
          return of([]);
        })
      ),
      rules: this.rulesApi.getScoringRules({ headers: { 'Authorization': `Bearer ${token}` }, params: { '_': Date.now() } }).pipe(
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

          if (!silent) this.isLoading = false;
          console.log('[Admin] Initial loading completed successfully');
          console.log('DEBUG ARRAYS: playersReport isArray?', Array.isArray(this.playersReport), 'type:', typeof this.playersReport);
          console.log('DEBUG ARRAYS: fraudCases isArray?', Array.isArray(this.fraudCases), 'type:', typeof this.fraudCases);
          console.log('DEBUG ARRAYS: recalcLiveLines isArray?', Array.isArray(this.recalcLiveLines), 'type:', typeof this.recalcLiveLines);
          console.log('DEBUG ARRAYS: recalcSummary.logs isArray?', this.recalcSummary ? Array.isArray(this.recalcSummary.logs) : 'N/A');
          console.log('DEBUG ARRAYS: getPaginatedPlayers() isArray?', Array.isArray(this.getPaginatedPlayers()), 'type:', typeof this.getPaginatedPlayers());

          if (!Array.isArray(this.playersReport)) this.playersReport = [];
          if (!Array.isArray(this.fraudCases)) this.fraudCases = [];
          if (!Array.isArray(this.duplicateCases)) this.duplicateCases = [];
          if (!Array.isArray(this.recalcLiveLines)) this.recalcLiveLines = [];
          if (this.recalcSummary && !Array.isArray(this.recalcSummary.logs)) this.recalcSummary.logs = [];

          this.cdr.detectChanges();

          this.calculateMissingScorersList();

          // 2. Fetch and calculate only the active page's users
          this.calculatePageData();

          // 3. Trigger a full background audit to pre-populate global stats and fraud cases
          this.runFullAudit();
        } catch (e) {
          console.error('[Admin] Exception in forkJoin next handler:', e);
          this.errorMessage = 'Exception lors de l\'initialisation : ' + e;
          if (!silent) this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('[Admin] forkJoin error handler:', err);
        this.errorMessage = 'Erreur lors de l\'initialisation des données : ' + (err.message || err);
        if (!silent) this.isLoading = false;
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

      // Directus filter syntax: filter[user][_in]=username1,username2...
      const usernames = playersToFetch.map(p => p.username.toLowerCase().trim()).join(',');
      const queryStr = `?limit=-1&fields=id,user,game_id,fulltime_a,fulltime_b,halftime_a,halftime_b,winner_draw,scorer,created_on,modified_on,points&filter[user][in]=${usernames}`;
      const predictionsUrl = encodeURI(queryStr).replace(/\[/g, '%5B').replace(/\]/g, '%5D');

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

              // Sort userPredictions DESCENDING to take the newest valid occurrence of multiple records
              userPredictions.sort((a, b) => {
                const dateA = a.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(a.created_on))).getTime() : 0;
                const dateB = b.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(b.created_on))).getTime() : 0;
                return dateB - dateA;
              });

              const processedGames = new Set<string>();

              userPredictions.forEach(p => {
                stats.totalPredictions++;

                const createdTime = p.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(p.created_on))) : null;
                const modifiedTime = p.modified_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(p.modified_on))) : null;
                if (createdTime && modifiedTime && Math.abs(modifiedTime.getTime() - createdTime.getTime()) > 5000) {
                  stats.modifiedCount++;
                }

                const match = this.matches.find(m => String(m.id) === String(p.game_id));
                if (match) {
                  const kickoffTime = new Date(this.pointsCalculatorService.parseMauritianDate(match.date));
                  let isLate = false;
                  if (createdTime && createdTime > kickoffTime) {
                    isLate = true;
                  } else if (modifiedTime && modifiedTime > kickoffTime) {
                    isLate = true;
                  }

                  const gameIdStr = String(p.game_id);
                  let isDuplicate = false;
                  if (processedGames.has(gameIdStr)) {
                    isDuplicate = true;
                  } else if (!isLate && ((p.fulltime_a !== null && p.fulltime_a !== "") || (p.winner_draw !== null && p.winner_draw !== ""))) {
                    processedGames.add(gameIdStr);
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
                        reason: createdTime && createdTime > kickoffTime ? 'Création après coup d\'envoi' : 'Modification après coup d\'envoi',
                        predictionId: p.id
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

                  if (!isLate && !isDuplicate && match.fulltime_a !== null && match.fulltime_b !== null) {
                    breakdown = this.pointsCalculatorService.calculatePoints(match, p, this.rules);
                    pointsEarned = breakdown.total;
                    calculatedPoints += pointsEarned;

                    const phaseName = match.phase || 'Groupe';
                    stats.pointsByPhase[phaseName] = (stats.pointsByPhase[phaseName] || 0) + pointsEarned;
                  }

                  // Build detail object
                  stats.predictionsDetail.push({
                    predictionId: p.id,
                    matchId: match.id,
                    match: `${match.team_a} vs ${match.team_b}`,
                    phase: match.phase || 'Groupe',
                    kickoff: kickoffTime,
                    submittedAt: createdTime,
                    modifiedAt: modifiedTime,
                    prediction: `${p.fulltime_a ?? '-'} - ${p.fulltime_b ?? '-'} (${p.winner_draw || 'N/A'})`,
                    halftime_prediction: `${p.halftime_a ?? '-'} - ${p.halftime_b ?? '-'}`,
                    scorer_prediction: p.scorer || '-',
                    actualScore: match.fulltime_a !== null ? `${match.fulltime_a} - ${match.fulltime_b}` : 'À venir',
                    calculatedPoints: (isLate || isDuplicate) ? 0 : pointsEarned,
                    directusPoints: (() => {
                      if (p.breakdown) {
                        let bd = p.breakdown;
                        if (typeof bd === 'string') {
                          try { bd = JSON.parse(bd); } catch(e) {}
                        }
                        if (typeof bd === 'object' && bd !== null) {
                          return bd.total !== undefined ? Number(bd.total) : 0;
                        }
                      }
                      return p.points !== null && p.points !== undefined ? Number(p.points) : null;
                    })(),
                    hasDiscrepancy: false, // will calculate below
                    isLate: isLate,
                    isDuplicate: isDuplicate,
                    breakdown: breakdown,
                    winner_draw: p.winner_draw,
                    team_a: match.team_a,
                    team_b: match.team_b
                  });
                  
                  // Calculate discrepancy correctly
                  const lastIndex = stats.predictionsDetail.length - 1;
                  const detail = stats.predictionsDetail[lastIndex];
                  const dbPoints = detail.directusPoints !== null ? detail.directusPoints : 0;
                  detail.hasDiscrepancy = dbPoints !== detail.calculatedPoints && !detail.isLate && !detail.isDuplicate;

                  if (match.fulltime_a !== null && match.fulltime_b !== null) {
                    recentMatches.push({
                      date: kickoffTime,
                      points: pointsEarned,
                      breakdown: breakdown
                    });
                  }
                }
              });

              // Add matches that have not been predicted
              const predictedMatchIds = new Set(stats.predictionsDetail.map(d => String(d.matchId)));
              this.matches.forEach(match => {
                if (!predictedMatchIds.has(String(match.id))) {
                  const kickoffTime = new Date(this.pointsCalculatorService.parseMauritianDate(match.date));
                  stats.predictionsDetail.push({
                    predictionId: null,
                    matchId: match.id,
                    match: `${match.team_a} vs ${match.team_b}`,
                    phase: match.phase || 'Groupe',
                    kickoff: kickoffTime,
                    submittedAt: null,
                    modifiedAt: null,
                    prediction: 'Non Prédit',
                    halftime_prediction: '-',
                    scorer_prediction: '-',
                    actualScore: match.fulltime_a !== null ? `${match.fulltime_a} - ${match.fulltime_b}` : 'À venir',
                    calculatedPoints: 0,
                    directusPoints: null,
                    hasDiscrepancy: false,
                    isLate: false,
                    isDuplicate: false,
                    breakdown: { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false },
                    winner_draw: null,
                    team_a: match.team_a,
                    team_b: match.team_b
                  });
                }
              });

              // Sort predictions detail by kickoff date descending
              stats.predictionsDetail.sort((a, b) => {
                if (!a.kickoff && !b.kickoff) return 0;
                if (!a.kickoff) return 1;
                if (!b.kickoff) return -1;
                return b.kickoff.getTime() - a.kickoff.getTime();
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
    this.predictionsApi.getPredictions('?limit=-1&fields=id,user,game_id,fulltime_a,fulltime_b,halftime_a,halftime_b,winner_draw,scorer,created_on,modified_on,points', httpOptions).pipe(
      timeout(30000),
      catchError(() => of({ data: [] }))
    ).subscribe({
      next: (res: any) => {
        this.predictions = res?.data || res || [];
        this.fraudCases = [];
        this.duplicateCases = [];
        this.incompleteScoreCases = [];
        this.groupedScoreAnomalies = [];
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

          // Query matching ranking record from pronostics_rankings collection
          const rankingRow = this.rankings.find((r: any) => (r.key || r.user || '').toLowerCase().trim() === userKey);
          const pronostiquesFromRankings: any[] = rankingRow?.pronostiques || [];

          let calculatedPoints = 0;
          let hasFraud = false;

          // Sort userPredictions DESCENDING to take the newest valid occurrence of multiple records
          userPredictions.sort((a, b) => {
            const dateA = a.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(a.created_on))).getTime() : 0;
            const dateB = b.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(b.created_on))).getTime() : 0;
            return dateB - dateA;
          });

          const processedGames = new Set<string>();

          userPredictions.forEach(p => {
            const createdTime = p.created_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(p.created_on))) : null;
            const modifiedTime = p.modified_on ? new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(p.modified_on))) : null;
            const match = this.matches.find(m => String(m.id) === String(p.game_id));

            if (match) {
              const kickoffTime = new Date(this.pointsCalculatorService.parseMauritianDate(match.date));
              let isLate = false;
              if (createdTime && createdTime.getTime() >= kickoffTime.getTime()) {
                isLate = true;
              } else if (modifiedTime && modifiedTime.getTime() >= kickoffTime.getTime()) {
                isLate = true;
              }

              const gameIdStr = String(p.game_id);
              let isDuplicate = false;
              if (processedGames.has(gameIdStr)) {
                isDuplicate = true;
              } else if (!isLate && ((p.fulltime_a !== null && p.fulltime_a !== "") || (p.winner_draw !== null && p.winner_draw !== ""))) {
                processedGames.add(gameIdStr);
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
                  reason: createdTime && createdTime > kickoffTime ? 'Création après coup d\'envoi' : 'Modification après coup d\'envoi',
                  predictionId: p.id
                });
              }

              if (isDuplicate) {
                this.duplicateCases.push({
                  user: stats.username,
                  matchId: match.id,
                  matchName: `${match.team_a} vs ${match.team_b}`,
                  kickoff: kickoffTime,
                  submittedAt: createdTime,
                  modifiedAt: modifiedTime,
                  reason: 'Doublon détecté',
                  predictionId: p.id
                });
              }

              // Query matching prediction stored inside pronostics_rankings collection
              let rankingProno = null;
              if (p.id) {
                rankingProno = pronostiquesFromRankings.find((pr: any) => String(pr.id) === String(p.id));
              }
              if (!rankingProno && p.game_id) {
                rankingProno = pronostiquesFromRankings.find((pr: any) => String(pr.game_id) === String(p.game_id));
              }

              let directusTotal = 0;
              let directusFt = 0;
              let directusHt = 0;

              const targetBd = rankingProno?.breakdown || p.breakdown;
              if (targetBd) {
                let bd = targetBd;
                if (typeof bd === 'string') {
                  try { bd = JSON.parse(bd); } catch(e) {}
                }
                if (typeof bd === 'object' && bd !== null) {
                  directusTotal = bd.total !== undefined ? Number(bd.total) : 0;
                  directusFt = bd.fulltime !== undefined ? Number(bd.fulltime) : 0;
                  directusHt = bd.halftime !== undefined ? Number(bd.halftime) : 0;
                }
              } else if (rankingProno?.points !== undefined && rankingProno?.points !== null) {
                directusTotal = Number(rankingProno.points);
              } else if (p.points !== undefined && p.points !== null) {
                directusTotal = Number(p.points);
              }

              // Special audit for halftime flag, knockout phase (match ID >= 73), and 0-converted game-rules calculation
              const matchHalftimeFlag = Boolean(match.halftime);
              const isKnockoutPhase = Number(match.id) >= 73;
              const isFtAInvalid = this.isNullOrEmptyOrDash(p.fulltime_a);
              const isFtBInvalid = this.isNullOrEmptyOrDash(p.fulltime_b);
              const isHtAInvalid = this.isNullOrEmptyOrDash(p.halftime_a);
              const isHtBInvalid = this.isNullOrEmptyOrDash(p.halftime_b);
              const isWdInvalid = this.isNullOrEmptyOrDash(p.winner_draw);
              const hasScoreNull = isFtAInvalid || isFtBInvalid || isHtAInvalid || isHtBInvalid || isWdInvalid;

              // Convert null/empty/- fields to 0 for game-rules recalculation
              const convertedProno = {
                ...p,
                fulltime_a: isFtAInvalid ? 0 : p.fulltime_a,
                fulltime_b: isFtBInvalid ? 0 : p.fulltime_b,
                halftime_a: isHtAInvalid ? 0 : p.halftime_a,
                halftime_b: isHtBInvalid ? 0 : p.halftime_b,
                winner_draw: p.winner_draw
              };

              let recalcBreakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
              if (!isLate && !isDuplicate && match.fulltime_a !== null && match.fulltime_b !== null) {
                recalcBreakdown = this.pointsCalculatorService.calculatePoints(match, convertedProno, this.rules);
              }

              // Discrepancy is ONLY calculated for knockout phase (match ID >= 73)
              const hasDiscrepancy = isKnockoutPhase && ((directusTotal !== recalcBreakdown.total) || (directusFt !== recalcBreakdown.fulltime) || (directusHt !== recalcBreakdown.halftime));

              let isAnomaly = false;
              const reasons: string[] = [];

              // Condition 1: halftime flag is true on match, but prediction halftime score is missing/null/empty/dash
              if (matchHalftimeFlag && (isHtAInvalid || isHtBInvalid)) {
                isAnomaly = true;
                reasons.push('Score MT manquant (Match avec halftime = true)');
              }

              // Condition 2: Knockout phase (match ID >= 73) with incomplete fulltime or winner_draw
              if (isKnockoutPhase) {
                if (isFtAInvalid || isFtBInvalid) {
                  isAnomaly = true;
                  reasons.push('Score TR manquant (Phase finale ≥ #73)');
                }
                if (isWdInvalid) {
                  isAnomaly = true;
                  reasons.push('Vainqueur qualifié manquant (Phase finale ≥ #73)');
                }
              }

              // Condition 3: Discrepancy between Directus points and 0-converted game-rules calculation (only for KO phase >= #73)
              if (hasDiscrepancy) {
                isAnomaly = true;
                reasons.push(`Écart de points (pronostics_rankings: TR ${directusFt}/MT ${directusHt}/Total ${directusTotal} pts vs Recalculé avec '0': TR ${recalcBreakdown.fulltime}/MT ${recalcBreakdown.halftime}/Total ${recalcBreakdown.total} pts)`);
              }

              if (hasDiscrepancy) {
                this.incompleteScoreCases.push({
                  user: stats.username,
                  matchId: match.id,
                  matchName: `${match.team_a} vs ${match.team_b}`,
                  kickoff: kickoffTime,
                  submittedAt: createdTime,
                  modifiedAt: modifiedTime,
                  reason: reasons.join(' | ') || 'Score incomplet/null/-',
                  predictionId: p.id,
                  fulltime_a: p.fulltime_a,
                  fulltime_b: p.fulltime_b,
                  halftime_a: p.halftime_a,
                  halftime_b: p.halftime_b,
                  winner_draw: p.winner_draw,
                  matchHalftimeFlag: matchHalftimeFlag,
                  pointsAwarded: directusTotal,
                  halftimePointsAwarded: directusHt,
                  directusFulltimePoints: directusFt,
                  recalculatedFulltimePoints: recalcBreakdown.fulltime,
                  recalculatedHalftimePoints: recalcBreakdown.halftime,
                  recalculatedTotalPoints: recalcBreakdown.total,
                  hasDiscrepancy: hasDiscrepancy,
                  discrepancyText: hasDiscrepancy ? `Directus (${directusTotal} pts: TR ${directusFt}, MT ${directusHt}) ≠ Recalculé (${recalcBreakdown.total} pts: TR ${recalcBreakdown.fulltime}, MT ${recalcBreakdown.halftime})` : ''
                });
              }

              if (!isLate && !isDuplicate && match.fulltime_a !== null && match.fulltime_b !== null) {
                const breakdown = this.pointsCalculatorService.calculatePoints(match, p, this.rules);
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

        // Group anomalies by user
        const map = new Map<string, UserAnomalyGroup>();
        this.incompleteScoreCases.forEach(item => {
          const key = item.user.toLowerCase().trim();
          if (!map.has(key)) {
            map.set(key, {
              username: item.user,
              totalAnomalies: 0,
              totalPointsAwarded: 0,
              totalFulltimePointsAwarded: 0,
              totalHalftimePointsAwarded: 0,
              cases: [],
              isExpanded: false
            });
          }
          const group = map.get(key)!;
          group.totalAnomalies++;
          group.totalPointsAwarded += (item.pointsAwarded || 0);
          group.totalFulltimePointsAwarded += (item.directusFulltimePoints || 0);
          group.totalHalftimePointsAwarded += (item.halftimePointsAwarded || 0);
          group.cases.push(item);
        });
        this.groupedScoreAnomalies = Array.from(map.values()).sort((a, b) => b.totalAnomalies - a.totalAnomalies);

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
    this.refreshSelectedPlayer();
  }

  closeDetails(): void {
    this.selectedPlayer = null;
  }

  isRefreshingPlayer = false;

  refreshSelectedPlayer(): void {
    if (!this.selectedPlayer) return;
    this.isRefreshingPlayer = true;
    
    const token = this.cookieService.get('currentToken');
    if (!token) {
      this.isRefreshingPlayer = false;
      return;
    }

    const username = this.selectedPlayer.username.toLowerCase().trim();
    
    // Fetch updated ranking and pronostiques for this specific user
    this.pronosticsRankingsApi.getRankings(`?filter[key]=${username}&_=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } }).subscribe({
      next: (res: any) => {
        const ranking = (res?.data || res || [])[0];
        if (ranking) {
          // Update total points from ranking
          this.selectedPlayer!.directusPoints = ranking.point || 0;
          
          const pronoList = ranking.pronostiques || [];
          
          // Update DB Points for each match directly from the ranking's JSON field
          this.selectedPlayer!.predictionsDetail.forEach(detail => {
            let prono = null;
            if (detail.predictionId) {
                prono = pronoList.find((p: any) => String(p.id) === String(detail.predictionId));
            } else {
                prono = pronoList.find((p: any) => String(p.game_id) === String(detail.matchId));
            }
            if (prono && prono.breakdown) {
               let bd = prono.breakdown;
               if (typeof bd === 'string') {
                 try { bd = JSON.parse(bd); } catch(e) {}
               }
               if (typeof bd === 'object' && bd !== null) {
                 detail.directusPoints = bd.total !== undefined ? Number(bd.total) : 0;
                 // detail.breakdown = bd; // Optional if we want to store it
               }
            } else if (prono && prono.points !== undefined && prono.points !== null) {
               detail.directusPoints = Number(prono.points);
            }
            
            const dbPoints = detail.directusPoints !== null ? detail.directusPoints : 0;
            detail.hasDiscrepancy = dbPoints !== detail.calculatedPoints && !detail.isLate && !detail.isDuplicate;
          });
          
          this.selectedPlayer!.pointDiscrepancy = this.selectedPlayer!.predictionsDetail.some(d => d.hasDiscrepancy);
        }
        
        this.isRefreshingPlayer = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Admin] refreshSelectedPlayer error:', err);
        this.isRefreshingPlayer = false;
        this.cdr.detectChanges();
      }
    });
  }

  exportPlayerDetailsToCSV(player: PlayerStats): void {
    if (!player || !player.predictionsDetail || player.predictionsDetail.length === 0) return;

    const headers = [
      'ID Match',
      'Match',
      'Phase',
      'Coup d\'envoi',
      'Envoi (Created)',
      'Modif (Modified)',
      'Prono (FM)',
      'Prono (MT)',
      'Buteur',
      'Score Réel',
      'Points Calculés',
      'Pts: Vainqueur',
      'Pts: Score Exact',
      'Pts: Mi-temps',
      'Pts: Buteur',
      'Pts: Consolation',
      'En retard',
      'Doublon'
    ];

    const escapeCsv = (val: any, preventDateParse = false) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
      // Use ="value" trick for Excel to prevent parsing e.g. "4 - 6" as a date
      if (preventDateParse && /^\d+\s*-\s*\d+/.test(str)) {
        return `="${str}"`;
      }
      return `"${str}"`;
    };

    const rows = player.predictionsDetail.map(d => {
      const kickoff = d.kickoff ? new Date(d.kickoff).toLocaleString('fr-FR') : '';
      const submitted = d.submittedAt ? new Date(d.submittedAt).toLocaleString('fr-FR') : '';
      const modified = d.modifiedAt ? new Date(d.modifiedAt).toLocaleString('fr-FR') : '';
      const b = d.breakdown || { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0 };
      
      return [
        escapeCsv(d.matchId),
        escapeCsv(d.match),
        escapeCsv(d.phase),
        escapeCsv(kickoff),
        escapeCsv(submitted),
        escapeCsv(modified),
        escapeCsv(d.prediction, true),
        escapeCsv(d.halftime_prediction, true),
        escapeCsv(d.scorer_prediction),
        escapeCsv(d.actualScore, true),
        escapeCsv(d.calculatedPoints),
        escapeCsv(b.winner),
        escapeCsv(b.fulltime),
        escapeCsv(b.halftime),
        escapeCsv(b.scorer),
        escapeCsv(b.consolation),
        escapeCsv(d.isLate ? 'Oui' : 'Non'),
        escapeCsv(d.isDuplicate ? 'Oui' : 'Non')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pronostics_${player.username}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Revisions logic
  openRevisionsModal(fraudCase: FraudReport): void {
    this.selectedRevisionPrediction = fraudCase;
    this.isLoadingRevisions = true;
    this.revisionsError = '';
    this.selectedRevisions = [];

    const token = this.cookieService.get('currentToken');
    if (!token) {
      this.revisionsError = 'Non autorisé';
      this.isLoadingRevisions = false;
      return;
    }

    const httpOptions = { headers: { 'Authorization': `Bearer ${token}` } };
    const query = `?filter[collection]=pronostiques&filter[item]=${fraudCase.predictionId}&sort=-id`;

    this.predictionsApi.getRevisions(query, httpOptions).pipe(
      timeout(10000),
      catchError(err => {
        console.error('Failed to load revisions:', err);
        this.revisionsError = 'Erreur lors du chargement de l\'historique';
        return of({ data: [] });
      })
    ).subscribe((res: any) => {
      const revs = res?.data || res || [];
      
      // Enrechir avec les anciennes valeurs
      for (let i = 0; i < revs.length; i++) {
        const currentRev = revs[i];
        
        const rawTime = currentRev.timestamp || currentRev.data?.modified_on || currentRev.data?.created_on;
        if (rawTime) {
          currentRev._parsedTimestamp = new Date(this.pointsCalculatorService.parseMauritianDate(this.pointsCalculatorService.convertDirectusToMauritianString(rawTime)));
        }

        if (currentRev.delta) {
          const previousRev = revs[i + 1];
          currentRev.changes = [];
          for (const key of Object.keys(currentRev.delta)) {
            const newValue = currentRev.delta[key];
            const oldValue = previousRev && previousRev.data ? previousRev.data[key] : 'N/A';
            currentRev.changes.push({ key, oldValue, newValue });
          }
        }
      }
      
      this.selectedRevisions = revs;
      this.isLoadingRevisions = false;
      this.cdr.detectChanges();
    });
  }

  closeRevisionsModal(): void {
    this.selectedRevisionPrediction = null;
    this.selectedRevisions = [];
  }

  missingScorersList: any[] = [];
  playersByTeamCache: { [teamName: string]: any[] } = {};

  calculateMissingScorersList() {
    const list: any[] = [];
    for (const m of this.matches) {
      if (!m.scorers) continue;

      let parsed: any[] | null = null;

      if (Array.isArray(m.scorers)) {
        parsed = m.scorers;
      } else if (typeof m.scorers === 'string' && m.scorers.toUpperCase().includes('NOT FOUND')) {
        try {
          parsed = JSON.parse(m.scorers);
          if (!Array.isArray(parsed)) parsed = null;
        } catch(e) {
          // Not a JSON array, fallback to full string
          list.push({
             match: m,
             scorerIndex: -1,
             originalName: m.scorers,
             time: '',
             teamName: m.team_a,
             newScorerName: ''
          });
        }
      }

      if (parsed) {
        parsed.forEach((scorerObj: any, index: number) => {
          if (scorerObj.player?.name?.toUpperCase().includes('NOT FOUND')) {
            list.push({
              match: m,
              scorerIndex: index,
              originalName: scorerObj.player.name,
              time: scorerObj.time?.elapsed || '',
              teamName: scorerObj.team?.name || m.team_a,
              newScorerName: '',
              isOwnGoal: false
            });
          }
        });
      }
    }
    this.missingScorersList = list;
  }

  getOtherTeamName(match: any, currentTeam: string) {
    if (match.team_a === currentTeam) return match.team_b;
    if (match.team_b === currentTeam) return match.team_a;
    return currentTeam;
  }

  getPlayersForTeam(teamName: string) {
    if (!teamName || !this.wccPlayers.length) return [];
    const cacheKey = teamName.toLowerCase();
    if (this.playersByTeamCache[cacheKey]) {
      return this.playersByTeamCache[cacheKey];
    }
    
    // Tries to match country/team fields loosely
    const players = this.wccPlayers.filter(p => {
      const pTeam = p.equipe || p.country || p.team || '';
      return pTeam.toLowerCase() === teamName.toLowerCase();
    }).sort((a, b) => this.getPlayerDisplayName(a).localeCompare(this.getPlayerDisplayName(b)));
    
    this.playersByTeamCache[cacheKey] = players;
    return players;
  }

  getPlayerRawName(player: any) {
    return player.player_name || player.nom || player.name || 'Unknown';
  }

  getPlayerDisplayName(player: any) {
    const rawName = this.getPlayerRawName(player);
    if (rawName === 'Unknown') return rawName;
    
    // Convert from "SURNAME Firstname" or "SURNAME" to "Firstname Surname" Title Case
    const parts = rawName.trim().split(/\s+/);
    if (parts.length > 1) {
      // Assuming last part is Firstname and rest is Surname(s)
      const firstName = parts.pop() || '';
      const surname = parts.join(' ');
      
      const formatWord = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      
      const formattedFirst = formatWord(firstName);
      const formattedSur = surname.split(' ').map(formatWord).join(' ');
      
      return `${formattedFirst} ${formattedSur}`;
    } else {
      // Just one word
      return rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    }
  }

  saveScorer(match: Matches, index: number, newName: string, isOwnGoal: boolean = false) {
    if (!newName) return;
    
    let newScorersData: any = newName;
    if (index !== -1 && match.scorers) {
      try {
        const parsed = typeof match.scorers === 'string' ? JSON.parse(match.scorers) : match.scorers;
        parsed[index].player.name = newName;
        if (isOwnGoal) {
          parsed[index].detail = "Own Goal";
        }
        // Send array directly, Directus handles JSON fields correctly when sent as JSON arrays
        newScorersData = parsed;
      } catch(e) {
        newScorersData = newName;
      }
    }

    this.matchesApiService.updateMatch(match.id, { scorers: newScorersData }).subscribe({
      next: () => {
        match.scorers = newScorersData;
        this.calculateMissingScorersList();
        this.alertDialog = { title: 'Succès', message: `Buteur mis à jour pour le match ${match.team_a} vs ${match.team_b}.` };
        this.tryDetectChanges();
      },
      error: (err) => {
        this.alertDialog = { title: 'Erreur', message: 'Impossible de mettre à jour : ' + (err.error?.error || err.message), isError: true };
        this.tryDetectChanges();
      }
    });
  }

  isSanitizing = false;
  sanitizeLogs: string[] = [];
  showSanitizeModal = false;

  sanitizeScorers() {
    this.isSanitizing = true;
    this.showSanitizeModal = true;
    this.sanitizeLogs = [];
    
    const eventSource = new EventSource(`${environment.apiBaseUrl}/admin/migrate-scorers/stream?dryRun=false`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.done) {
        this.isSanitizing = false;
        eventSource.close();
        this.loadAdminData(); // Refresh matches list when done
      } else if (data.log) {
        this.sanitizeLogs.push(data.log);
      } else if (data.error) {
        this.sanitizeLogs.push('[ERROR] ' + data.error);
        this.isSanitizing = false;
        eventSource.close();
      }
      this.tryDetectChanges();
    };

    eventSource.onerror = (err) => {
      this.sanitizeLogs.push('[ERROR] La connexion au serveur a été interrompue.');
      this.isSanitizing = false;
      eventSource.close();
      this.tryDetectChanges();
    };
  }
  
  closeSanitizeModal() {
    this.showSanitizeModal = false;
  }
}
