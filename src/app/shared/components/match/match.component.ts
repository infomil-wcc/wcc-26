import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { max, Observable, Subscription } from 'rxjs';
import { TeamsService } from '../../services/content/teams.service';
import { StateService } from '../../services/core/state.service';
import { PredictionsService } from '../../services/games/predictions.service';
import { GlobaltimeService } from '../../services/core/globaltime.service';
import { StadiumsService } from '../../services/content/stadiums.service';
import { NgClass, NgStyle, AsyncPipe, UpperCasePipe, SlicePipe, DatePipe } from '@angular/common';
import { NumberInputComponent } from '../number-input/number-input.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LoaderComponent } from '../loader/loader.component';
import { TacticalLineupComponent } from '../tactical-lineup/tactical-lineup.component';
import { LineupsApiService } from '../../services/api/lineups-api.service';
import { TeamperformanceComponent } from '../teamperformance/teamperformance.component';

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, NgStyle, TeamperformanceComponent, NumberInputComponent, ReactiveFormsModule, FormsModule, LoaderComponent, UpperCasePipe, SlicePipe, DatePipe, TacticalLineupComponent]
})
export class MatchComponent implements OnInit, OnDestroy {

  teamService = inject(TeamsService);
  predictionService = inject(PredictionsService);
  stateService = inject(StateService);
  globalTime = inject(GlobaltimeService);
  stadiumsService = inject(StadiumsService);
  lineupsService = inject(LineupsApiService);
  cdr = inject(ChangeDetectorRef);

  @Input() match!: Matches;
  @Input() isPronostiques: boolean = false;
  @Input() disabled: boolean = false;
  penaltyWinner: string | null = null;
  @Input() dateTime!: string;
  @Input() hasPlayed!: boolean;
  @Input() hidePointsBadge: boolean = false; // Flag to overlay fraud notice rather than point pill layout
  @Input() invalidatedDate: Date = new Date();
  @Output() hasPlayedChange = new EventEmitter<boolean>;


  protected showLoader: boolean = false;
  protected pronostiqueDone: boolean = false;

  protected userId: number = 0;
  protected userTrigramme: string = '';
  protected halfTimeA: number | null = 0;
  protected halfTimeB: number | null = 0;
  protected fullTimeA: number | null = 0;
  protected fullTimeB: number | null = 0;
  protected scorer: string = '';
  protected matchOutcome: string = '';
  protected limitDate!: Date;
  protected closed: boolean = false;
  protected calcWinDrawOutcome: boolean = false;
  protected today!: Date;
  protected teamAFlag: string = '';
  protected teamBFlag: string = '';
  protected stadiumImageUrl: string = '';
  protected countdownText: string = '';
  protected isSavedInApi: boolean = false;
  private countdownIntervalId: any;
  private timeOffset: number = 0;
  protected $players!: Observable<any>;
  protected donePronostique!: any;
  protected showPronostiqueModal = false;
  protected isSubmitting = false;
  protected isEditing = false;

  protected showTacticalModal: boolean = false;
  protected lineupsData: any = null;
  protected fallbackPlayersList: any[] = [];
  protected loadingLineups: boolean = false;
  private refreshSub!: Subscription;
  private savedSub!: Subscription;
  /** Prevents stale API cache from overwriting a freshly-saved prediction */
  private justSaved: boolean = false;


  ngOnInit(): void {

    this.today = new Date(this.dateTime.slice(0, -6));
    const serverTime = this.today.getTime();
    const localTime = new Date().getTime();
    this.timeOffset = serverTime - localTime;

    this.stateService.userState.subscribe({
      next: (response) => {
        if (response.id !== null) {
          (response.id) ? this.userId = parseInt(response.id) : "";
          (response.last_name) ? this.userTrigramme = response.last_name : "";
          if (this.isPronostiques) {
            this.verfierMonPronostique();
          }
        }
      }
    })

    if (this.isPronostiques && this.userId !== 0) {
      this.verfierMonPronostique();
    }

    this.refreshSub = this.predictionService.refresh$.subscribe(() => {
      // Skip re-fetch if we just saved — the API cache may still return stale data
      if (this.justSaved) return;
      if (this.isPronostiques && this.userId !== 0) {
        this.verfierMonPronostique();
      }
    });

    // Reactively apply saved prediction data without an API round-trip
    this.savedSub = this.predictionService.savedPredictions$.subscribe((savedMap) => {
      const saved = savedMap.get(this.match.id);
      if (!saved) return;

      // Block stale cache from overwriting this for 5 seconds
      this.justSaved = true;
      if ((this as any)._justSavedTimer) clearTimeout((this as any)._justSavedTimer);
      (this as any)._justSavedTimer = setTimeout(() => { this.justSaved = false; }, 5000);

      this.pronostiqueDone = true;
      this.isSavedInApi = true;
      this.isEditing = false;
      this.donePronostique = { ...saved };
      this.matchOutcome = saved.winner_draw ?? '';
      this.fullTimeA = (saved.fulltime_a !== null && saved.fulltime_a !== undefined && saved.fulltime_a !== '') ? parseInt(saved.fulltime_a, 10) : null;
      this.fullTimeB = (saved.fulltime_b !== null && saved.fulltime_b !== undefined && saved.fulltime_b !== '') ? parseInt(saved.fulltime_b, 10) : null;
      this.halfTimeA = (saved.halftime_a !== null && saved.halftime_a !== undefined && saved.halftime_a !== '') ? parseInt(saved.halftime_a, 10) : null;
      this.halfTimeB = (saved.halftime_b !== null && saved.halftime_b !== undefined && saved.halftime_b !== '') ? parseInt(saved.halftime_b, 10) : null;
      this.scorer = saved.scorer ?? '';

      if (this.match.phase !== 'Group Stage' && this.fullTimeA !== null && this.fullTimeA === this.fullTimeB) {
        this.matchOutcome = 'Draw';
        this.penaltyWinner = saved.winner_draw;
      } else {
        this.penaltyWinner = null;
      }

      // Force Angular to re-render synchronously in the current microtask
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });

    let matchDate = new Date(this.match.date)
    this.limitDate = this.subtractHours(matchDate);

    if (this.today > this.limitDate) {
      this.closed = true;

      if (this.match.fulltime_a === null || this.match.fulltime_b === null) {
        const matchTime = new Date(this.match.date).getTime();
        const nowTime = this.today.getTime();

        const completionTime = matchTime + 120 * 60 * 1000;
        const thirtyMinsAfterTime = matchTime + 150 * 60 * 1000;

        const isAtCompletion = nowTime >= completionTime && nowTime < completionTime + 5 * 60 * 1000;
        const isAtThirtyMinsAfter = nowTime >= thirtyMinsAfterTime && nowTime < thirtyMinsAfterTime + 5 * 60 * 1000;

        if (isAtCompletion || isAtThirtyMinsAfter) {
          const storageKey = `sync_match_${this.match.id}_${isAtCompletion ? 'completion' : '30mins'}`;
          if (!localStorage.getItem(storageKey)) {
            localStorage.setItem(storageKey, 'true');
            this.predictionService.updateResults().subscribe({
              next: (res) => {
                console.log(`Automatically updated results for match ${this.match.id}`, res);
              },
              error: (err) => {
                console.error('Error auto-updating match results:', err);
              }
            });
          }
        }
      }
    }

    this.getTeamFlag(this.match.team_a, (flag: string) => this.teamAFlag = flag);
    this.getTeamFlag(this.match.team_b, (flag: string) => this.teamBFlag = flag);
    this.getStadiumImage();
    this.startCountdown();

    if (this.match.fulltime) {
      this.calcWinDrawOutcome = true;
    }
  }

  ngOnDestroy(): void {
      if (this.countdownIntervalId) {
        clearInterval(this.countdownIntervalId);
      }
      if (this.refreshSub) {
        this.refreshSub.unsubscribe();
      }
      if (this.savedSub) {
        this.savedSub.unsubscribe();
      }
    }

  subtractHours(date: Date): Date {
    const newDate = new Date(date);
    // 5mins
    newDate.setTime(newDate.getTime() - (5 * 60 * 1000));
    return newDate;
  }

  nationalitySelected(ev: Event): void {
    let selectBox = ev.target as HTMLSelectElement;
    this.$players = this.teamService.getPlayersByTeamName(selectBox.value);

    this.$players.subscribe({
      next: (response) => {
        console.log(response[0].players);
      }
    })
  }

  protected openTacticalLineup(): void {
    if (this.disabled || this.isSubmitting || (!this.isEditing && (this.match.fulltime || this.isSavedInApi || this.closed))) {
      return;
    }
    this.showTacticalModal = true;
    this.loadingLineups = true;

    this.teamService.getPlayersByTeamName(this.match.team_a).subscribe(playersA => {
      this.teamService.getPlayersByTeamName(this.match.team_b).subscribe(playersB => {
        const listA = (playersA?.players || []).map((p: any) => ({ ...p, teamName: this.match.team_a }));
        const listB = (playersB?.players || []).map((p: any) => ({ ...p, teamName: this.match.team_b }));
        this.fallbackPlayersList = [...listA, ...listB];

        this.lineupsService.getLineups(this.match.team_a, this.match.team_b).subscribe({
          next: (res) => {
            this.lineupsData = res;
            this.loadingLineups = false;
          },
          error: (err) => {
            console.error('Error fetching lineups from football-data:', err);
            this.lineupsData = null;
            this.loadingLineups = false;
          }
        });
      });
    });
  }

  protected selectTacticalScorer(playerName: string) {
    this.scorer = playerName;
    this.showTacticalModal = false;
    this.sendBet();
  }

  protected clearScorer(): void {
    if (!this.canEditPrediction) {
      return;
    }
    this.scorer = '';
    this.sendBet();
  }

  getTeamFlag(teamName: string, callback: (flag: string) => void): void {
    this.teamService.getTeamByName(teamName).subscribe({
      next: (response) => {
        if (response.length > 0 && response[0].flag_url) {
          callback(response[0].flag_url);
        } else {
          callback('assets/flags/unknown.png');
        }
      },
      error: (err) => {
        console.error('Error fetching team flag:', err);
        callback('assets/flags/unknown.png');
      }
    });
  }

  onScoreChanged(): void {
    if (this.fullTimeA !== null && this.halfTimeA !== null && this.fullTimeA < this.halfTimeA) {
      this.halfTimeA = this.fullTimeA;
    }
    if (this.fullTimeB !== null && this.halfTimeB !== null && this.fullTimeB < this.halfTimeB) {
      this.halfTimeB = this.fullTimeB;
    }

    if (this.calcWinDrawOutcome) {
      this.matchOutcome = this.calculateWinDraw(this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
    }
    this.sendBet();
  }

  get canEditPrediction(): boolean {
    if (this.hidePointsBadge) {
      return false;
    }
    return !this.disabled && !this.isSubmitting && (!this.closed || this.isEditing) && !this.match.fulltime &&
      (!this.isSavedInApi || this.isEditing) && !this.hidePointsBadge;
  }

  get canEditScores(): boolean {
    if (this.hidePointsBadge) {
      return false;
    }
    return !this.disabled && !this.isSubmitting && (!this.closed || this.isEditing) &&
      (!this.isSavedInApi || this.isEditing) && !this.hidePointsBadge;
  }

  onHalftimeScoreChanged(): void {
    if (this.halfTimeA !== null) {
      if (this.fullTimeA === null || this.fullTimeA < this.halfTimeA) {
        this.fullTimeA = this.halfTimeA;
      }
    }
    if (this.halfTimeB !== null) {
      if (this.fullTimeB === null || this.fullTimeB < this.halfTimeB) {
        this.fullTimeB = this.halfTimeB;
      }
    }

    if (this.calcWinDrawOutcome) {
      this.matchOutcome = this.calculateWinDraw(this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
    }
    this.sendBet();
  }

  selectWinner(outcome: string): void {
    if (!this.canEditPrediction) {
      return;
    }
    this.matchOutcome = outcome;
    if (outcome !== 'Draw') {
      this.penaltyWinner = null;
    }
    this.sendBet();
  }

  selectPenaltyWinner(team: string): void {
    if (!this.canEditScores) {
      return;
    }
    this.penaltyWinner = team;
    this.sendBet();
  }

  sendBet() {
    let currentOutcome = this.matchOutcome;

    if (this.calcWinDrawOutcome) {
      currentOutcome = this.calculateWinDraw(this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
    }
    
    if (currentOutcome === 'Draw' && this.match.phase !== 'Group Stage' && this.penaltyWinner) {
      currentOutcome = this.penaltyWinner;
    }

    let prediction: any = {
      user: this.userTrigramme,
      game_id: this.match.id,
      halftime_a: (this.halfTimeA !== null && this.halfTimeA !== undefined) ? this.halfTimeA.toString() : null,
      halftime_b: (this.halfTimeB !== null && this.halfTimeB !== undefined) ? this.halfTimeB.toString() : null,
      fulltime_a: (this.fullTimeA !== null && this.fullTimeA !== undefined) ? this.fullTimeA.toString() : null,
      fulltime_b: (this.fullTimeB !== null && this.fullTimeB !== undefined) ? this.fullTimeB.toString() : null,
      scorer: this.scorer,
      winner_draw: currentOutcome,
    }

    const existingDraft = this.predictionService.getDrafts().find(d => d.game_id === this.match.id);
    if (existingDraft?.id) {
      prediction.id = existingDraft.id;
    } else if (this.donePronostique && this.donePronostique.id) {
      prediction.id = this.donePronostique.id;
    }

    prediction.game_id = this.match.id;
    this.predictionService.addDraft(prediction);

    this.pronostiqueDone = true;
    this.donePronostique = prediction;
    if (!this.isEditing) {
      this.isEditing = false;
    }
    this.showLoader = false;
    this.isSubmitting = false;
  }

  calculateWinDraw(teamA: string, teamB: string, scoreA: number | null, scoreB: number | null): string {
    if (scoreA === null || scoreA === undefined || scoreB === null || scoreB === undefined) {
      return '';
    }
    let outcome: string;

    (scoreA > scoreB) ? outcome = teamA : outcome = teamB;
    if (scoreA === scoreB) {
      if (this.match.phase !== 'Group Stage' && this.penaltyWinner) {
        outcome = this.penaltyWinner;
      } else {
        outcome = 'Draw';
      }
    }

    return outcome;
  }

  verfierMonPronostique(): void {
    // If we just saved a prediction, don't re-fetch yet — the API proxy cache
    // (60s TTL) would return stale data and overwrite the correct UI state.
    if (this.justSaved) return;

    this.predictionService.getMyPredictions(this.match.id).subscribe({
      next: (response) => {

        const drafts = this.predictionService.getDrafts();
        const draft = drafts.find(d => d.game_id === this.match.id);

        // Fonction utilitaire locale pour valider la triche à la volée
        const checkPayloadFraud = (pred: any): boolean => {
          if (!pred || !this.match.date) return false;

          // 1. Récupération du timestamp technique de Directus
          const predTimeStr = pred.modified_on || pred.created_on;
          if (!predTimeStr) {
            return false;
          }

          // 2. Conversion sécurisée en millisecondes
          const predTimestamp = new Date(predTimeStr).getTime();
          const matchTimestamp = new Date(this.match.date).getTime();

          this.invalidatedDate = new Date(predTimeStr);

          // 3. Log de débogage pour voir la réalité dans la console F12
          if (predTimestamp >= matchTimestamp) {
            console.log(`[Fraud Check] Match M${this.match.id} :`, {
              'Joué le': new Date(predTimeStr).toLocaleString(),
              'Coup d\'envoi': new Date(this.match.date).toLocaleString(),
              'predTimestamp': predTimestamp,
              'matchTimestamp': matchTimestamp,
              'Est une fraude ?': predTimestamp >= matchTimestamp
            });
          }

          // 4. Comparaison stricte des millisecondes UTC
          return predTimestamp >= matchTimestamp;
        };

        if (draft) {
          this.pronostiqueDone = true;
          this.isEditing = true;
          this.donePronostique = { ...draft };
          this.matchOutcome = draft.winner_draw;
          this.fullTimeA = (draft.fulltime_a !== null && draft.fulltime_a !== undefined && draft.fulltime_a !== '') ? parseInt(draft.fulltime_a, 10) : null;
          this.fullTimeB = (draft.fulltime_b !== null && draft.fulltime_b !== undefined && draft.fulltime_b !== '') ? parseInt(draft.fulltime_b, 10) : null;
          
          if (this.match.phase !== 'Group Stage' && this.fullTimeA !== null && this.fullTimeA === this.fullTimeB) {
            this.matchOutcome = 'Draw';
            this.penaltyWinner = draft.winner_draw;
          }

          this.halfTimeA = (draft.halftime_a !== null && draft.halftime_a !== undefined && draft.halftime_a !== '') ? parseInt(draft.halftime_a, 10) : null;
          this.halfTimeB = (draft.halftime_b !== null && draft.halftime_b !== undefined && draft.halftime_b !== '') ? parseInt(draft.halftime_b, 10) : null;
          this.scorer = draft.scorer || '';
          this.isSavedInApi = response.length > 0;

          // Calcul à la volée du badge de fraude sans modifier Directus
          this.hidePointsBadge = checkPayloadFraud(draft);

          if (response.length > 0 && response[0].id && !draft.id) {
            draft.id = response[0].id;
            this.donePronostique.id = response[0].id;
            this.predictionService.addDraft(draft);
          }
        } else if (response.length > 0) {
          this.pronostiqueDone = true;
          this.isSavedInApi = true;
          this.isEditing = false;
          this.donePronostique = response[0];
          this.matchOutcome = response[0].winner_draw;
          this.fullTimeA = (response[0].fulltime_a !== null && response[0].fulltime_a !== undefined && response[0].fulltime_a !== '') ? parseInt(response[0].fulltime_a, 10) : null;
          this.fullTimeB = (response[0].fulltime_b !== null && response[0].fulltime_b !== undefined && response[0].fulltime_b !== '') ? parseInt(response[0].fulltime_b, 10) : null;
          
          if (this.match.phase !== 'Group Stage' && this.fullTimeA !== null && this.fullTimeA === this.fullTimeB) {
            this.matchOutcome = 'Draw';
            this.penaltyWinner = response[0].winner_draw;
            
            // Auto-add to drafts if no penalty winner is selected so the floating dock appears
            if (!this.penaltyWinner || this.penaltyWinner.trim() === '' || this.penaltyWinner === 'Draw') {
              this.donePronostique.game_id = this.match.id;
              this.predictionService.addDraft(this.donePronostique);
            }
          }

          this.halfTimeA = (response[0].halftime_a !== null && response[0].halftime_a !== undefined && response[0].halftime_a !== '') ? parseInt(response[0].halftime_a, 10) : null;
          this.halfTimeB = (response[0].halftime_b !== null && response[0].halftime_b !== undefined && response[0].halftime_b !== '') ? parseInt(response[0].halftime_b, 10) : null;
          this.scorer = response[0].scorer || '';

          // Si le serveur renvoie un pronostic dont la date technique interne 
          // est supérieure au coup d'envoi, on active le bandeau visuel
          this.hidePointsBadge = checkPayloadFraud(response[0]);

          // 🚨 FORCE LE BLOCAGE DE L'AFFICHAGE DES POINTS SUR LES MATCHS JOUÉS TRUQUÉS
          if (this.hidePointsBadge) {
            this.isSavedInApi = false; // Désactive l'affichage des badges de points d'API classiques
          }

        } else {
          this.pronostiqueDone = false;
          this.donePronostique = null;
          this.isSavedInApi = false;
          this.isEditing = false;
          this.hidePointsBadge = false;
          this.fullTimeA = null;
          this.fullTimeB = null;
          this.halfTimeA = null;
          this.halfTimeB = null;
          this.matchOutcome = '';
          this.penaltyWinner = '';
          this.scorer = '';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        // 3. Capturer l'erreur si l'API plante (ex: 401 Unauthorized, 404, etc.)
        console.error(`[Vérification ❌ ERREUR API] Erreur sur le match M${this.match.id} :`, err);
        this.cdr.detectChanges();
      }
    });
  }

  getStadiumImage(): void {
    if (!this.match.stadium) return;
    this.stadiumsService.getStadium().subscribe({
      next: (stadiums: any[]) => {
        const found = stadiums.find(s => s.title.toLowerCase().trim() === this.match.stadium.toLowerCase().trim());
        if (found) {
          const id = parseInt(found.id, 10);
          if (id >= 1 && id <= 10) {
            this.stadiumImageUrl = `assets/stadium/photo/${found.id}.avif`;
          } else {
            this.stadiumImageUrl = `assets/stadium/photo/${found.id}.jpg`;
          }
        }
      }
    });
  }

  startCountdown(): void {
    const matchTime = new Date(this.match.date).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime() + this.timeOffset;
      const diff = matchTime - now;

      const status = this.match.status?.toLowerCase();
      if (status === 'finished' || this.match.played || diff <= -150 * 60 * 1000) {
        this.countdownText = 'Match terminé';
        return;
      }

      if (status === 'live' || status === 'in_play' || diff <= 0) {
        this.countdownText = 'Match commencé';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let text = '';
      if (days > 0) {
        text += `${days}j ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        text += `${hours}h ${minutes}m ${seconds}s`;
      } else {
        text += `${minutes}m ${seconds}s`;
      }
      this.countdownText = text;
    };

    updateCountdown();
    this.countdownIntervalId = setInterval(updateCountdown, 1000);
  }

  isOutcomeCorrect(): boolean {
    if (this.hidePointsBadge) return false; // 🚨 Bloque l'analyse ici - FRAUDE
    if (!this.donePronostique || !this.match || this.match.fulltime_a === null || this.match.fulltime_b === null || this.hidePointsBadge) {
      return false;
    }
    return this.donePronostique.winner_draw === this.match.winner_draw;
  }

  isFulltimeCorrect(): boolean {
    if (!this.donePronostique || !this.match || this.match.fulltime_a === null || this.match.fulltime_b === null || this.hidePointsBadge) {
      return false;
    }
    const predA = parseInt(this.donePronostique.fulltime_a, 10);
    const predB = parseInt(this.donePronostique.fulltime_b, 10);
    return predA === this.match.fulltime_a && predB === this.match.fulltime_b;
  }

  isHalftimeCorrect(): boolean {
    if (!this.donePronostique || !this.match || this.match.halftime_a === null || this.match.halftime_b === null || this.hidePointsBadge) {
      return false;
    }
    const predA = parseInt(this.donePronostique.halftime_a, 10);
    const predB = parseInt(this.donePronostique.halftime_b, 10);
    return predA === this.match.halftime_a && predB === this.match.halftime_b;
  }

  get parsedScorersEvents(): any[] {
    if (!this.match || !this.match.scorers) return [];
    const val = this.match.scorers;
    let list: any[] = [];
    if (Array.isArray(val)) {
      list = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          list = JSON.parse(trimmed);
        } catch (e) {
          list = [];
        }
      }
    }

    return list.map(e => {
      let name = e.player?.name || 'Unknown';
      let elapsed = e.time?.elapsed ?? 0;
      let extra = e.time?.extra ?? null;
      let detail = e.detail || 'Normal Goal';

      const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
      const match = name.trim().match(regex);
      if (match) {
        name = match[1].trim();
        elapsed = parseInt(match[2], 10);
        extra = match[3] ? parseInt(match[3], 10) : null;
        if (match[4]) {
          const detailLower = match[4].toLowerCase();
          if (detailLower.includes('og') || detailLower.includes('csc')) {
            detail = 'Own Goal';
          } else if (detailLower.includes('p') || detailLower.includes('pen')) {
            detail = 'Penalty';
          }
        }
      }
      return {
        ...e,
        player: { ...e.player, name },
        time: { elapsed, extra },
        detail
      };
    });
  }

  get isScorersJson(): boolean {
    return this.parsedScorersEvents.length > 0;
  }

  isScorerCorrect(): boolean {
    if (!this.donePronostique || !this.match || !this.match.scorers || this.hidePointsBadge) {
      return false;
    }
    const predScorer = this.donePronostique.scorer;
    if (!predScorer || predScorer === '-') return false;

    let scorersList: string[] = [];
    const scorersVal = this.match.scorers;
    if (Array.isArray(scorersVal)) {
      scorersList = scorersVal.map(e => {
        let name = e.player?.name || e.scorer?.name;
        if (name) {
          const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
          const match = name.trim().match(regex);
          if (match) {
            name = match[1].trim();
          }
        }
        return name;
      }).filter(Boolean);
    } else if (typeof scorersVal === 'string') {
      const trimmed = scorersVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            scorersList = parsed.map(e => {
              let name = e.player?.name || e.scorer?.name;
              if (name) {
                const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
                const match = name.trim().match(regex);
                if (match) {
                  name = match[1].trim();
                }
              }
              return name;
            }).filter(Boolean);
          }
        } catch (e) {
          scorersList = trimmed.split(',').map(name => name.trim());
        }
      } else {
        scorersList = trimmed.split(',').map(name => name.trim());
      }
    }

    const lowerScorers = scorersList.map(name => name.toLowerCase());
    return lowerScorers.includes(predScorer.trim().toLowerCase());
  }

  modifierPronostic(): void {
    if (this.match.fulltime_a !== null || this.match.fulltime_b !== null || this.hidePointsBadge) {
      return;
    }

    this.isEditing = true;
    this.disabled = false;
    this.isSavedInApi = false;
    
    if (this.donePronostique) {
      this.donePronostique.game_id = this.match.id;
      this.predictionService.addDraft(this.donePronostique);
    }
  }

  get matchPoints(): number | null {
    if (!this.donePronostique || !this.match ||
      this.match.fulltime_a === null || this.match.fulltime_b === null || this.hidePointsBadge) {
      return null;
    }
    const game = this.match;
    let points = 0;
    const winnerPts = Number(game.winner_point) || 0;
    const fulltimePts = Number(game.fulltime_point) || 0;
    const halftimePts = Number(game.halftime_point) || 0;
    const scorerPts = Number(game.scorer_point) || 0;

    if (game.phase === 'Group Stage') {
      if (this.isOutcomeCorrect()) points += winnerPts;
      if (game.id === '1' && this.isFulltimeCorrect()) points += fulltimePts;
    }

    const isKnockout = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(game.phase);

    if (isKnockout) {
      if (this.isOutcomeCorrect()) {
        points += winnerPts;
        if (game.penalty_shootout) {
          points += fulltimePts; // Award full score points if outcome is correct
        }
      }
      
      if (!game.penalty_shootout && this.isFulltimeCorrect()) {
        points += fulltimePts;
      }

      if (['Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(game.phase)) {
        if (this.isHalftimeCorrect()) points += halftimePts;
        if (this.isScorerCorrect()) points += scorerPts;
      }
    }

    return points;
  }

  getGroupedScorers(teamName: string): any[] {
    if (!this.match || !this.match.scorers) return [];
    const events = this.parsedScorersEvents;
    if (events.length === 0) return [];

    const teamEvents = events.filter(e => {
      const eventTeam = e.team?.name;
      return eventTeam && eventTeam.trim().toLowerCase() === teamName.trim().toLowerCase();
    });

    const groups: { [name: string]: string[] } = {};
    for (const e of teamEvents) {
      const name = e.player?.name || 'Unknown';
      let timeStr = `${e.time.elapsed}`;
      if (e.time.extra) {
        timeStr += `+${e.time.extra}`;
      }
      timeStr += "'";
      if (e.detail === 'Penalty') {
        timeStr += ' <sup>[PEN]</sup>';
      } else if (e.detail === 'Own Goal') {
        timeStr += ' <sup>[OG]</sup>';
      }

      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(timeStr);
    }

    return Object.keys(groups).map(name => ({
      name,
      times: `(${groups[name].join(', ')})`
    }));
  }

  get teamAScorersGrouped(): any[] {
    return this.getGroupedScorers(this.match.team_a);
  }

  get teamBScorersGrouped(): any[] {
    return this.getGroupedScorers(this.match.team_b);
  }
}
