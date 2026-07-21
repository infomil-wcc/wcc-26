import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { max, Observable, Subscription } from 'rxjs';
import { map, of } from 'rxjs';
import { TeamsService } from '../../services/content/teams.service';
import { StateService } from '../../services/core/state.service';
import { PredictionsService } from '../../services/games/predictions.service';
import Fuse from 'fuse.js';
import { GlobaltimeService } from '../../services/core/globaltime.service';
import { StadiumsService } from '../../services/content/stadiums.service';
import { NgClass, NgStyle, AsyncPipe, UpperCasePipe, SlicePipe, DatePipe, TitleCasePipe } from '@angular/common';
import { NumberInputComponent } from '../number-input/number-input.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LoaderComponent } from '../loader/loader.component';
import { TacticalLineupComponent } from '../tactical-lineup/tactical-lineup.component';
import { LineupsApiService } from '../../services/api/lineups-api.service';
import { TeamperformanceComponent } from '../teamperformance/teamperformance.component';
import { MatchesService } from '../../services/content/matches.service';

const PHASE_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'Group Stage', label: 'Phase de groupes', icon: 'groups', color: '#3b5bdb' },
  { key: 'Round of 32', label: 'Seizièmes de finale', icon: 'filter_none', color: '#7048e8' },
  { key: 'Round of 16', label: 'Huitièmes de finale', icon: 'filter_8', color: '#9c36b5' },
  { key: 'Quarter-finals', label: 'Quarts de finale', icon: 'emoji_events', color: '#d6336c' },
  { key: 'Semi-finals', label: 'Demi-finales', icon: 'military_tech', color: '#f76707' },
  { key: 'Third Place', label: 'Troisième place', icon: 'looks_3', color: '#0ca678' },
  { key: 'Final', label: 'Finale', icon: 'workspace_premium', color: '#f59f00' }
];

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, NgStyle, TeamperformanceComponent, NumberInputComponent, ReactiveFormsModule, FormsModule, LoaderComponent, UpperCasePipe, SlicePipe, DatePipe, TacticalLineupComponent, TitleCasePipe]
})
export class MatchComponent implements OnInit, OnDestroy {

  teamService = inject(TeamsService);
  predictionService = inject(PredictionsService);
  stateService = inject(StateService);
  globalTime = inject(GlobaltimeService);
  stadiumsService = inject(StadiumsService);
  lineupsService = inject(LineupsApiService);
  matchesService = inject(MatchesService);
  cdr = inject(ChangeDetectorRef);

  @Input() match!: Matches;
  @Input() isPronostiques: boolean = false;
  @Input() disabled: boolean = false;
  penaltyWinner: string | null = null;
  @Input() dateTime!: string;
  @Input() hasPlayed!: boolean;
  @Input() hidePointsBadge: boolean = false; 
  @Input() invalidatedDate: Date = new Date();

  protected showTeamInfoModal: boolean = false;
  protected selectedTeamName: string = '';
  protected loadingTeamInfo: boolean = false;
  protected teamPastMatches: Matches[] = [];
  protected flagsLookup: { [teamName: string]: string } = {};
  @Output() hasPlayedChange = new EventEmitter<boolean>;

  protected showLoader: boolean = false;
  protected pronostiqueDone: boolean = false;
  forceEnableScorerButton: boolean = false;

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
      if (this.justSaved) return;
      if (this.isPronostiques && this.userId !== 0) {
        this.verfierMonPronostique();
      }
    });

    this.savedSub = this.predictionService.savedPredictions$.subscribe((savedMap) => {
      const saved = savedMap.get(this.match.id);
      if (!saved) return;

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

      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });

    let matchDate = new Date(this.match.date)
    this.limitDate = this.subtractHours(matchDate);

    if (this.today > this.limitDate) {
      this.closed = true;
      this.predictionService.removeDraft(this.match.id);

      const status = this.match.current_status?.toLowerCase();
      const matchStartTime = new Date(this.match.date).getTime();
      const statusUpdatedTime = this.match.status_updated ? new Date(this.match.status_updated).getTime() : 0;
      const diffMinutes = (statusUpdatedTime - matchStartTime) / (60 * 1000);

      const isFullyUpdated =
        status === 'finished' &&
        this.match.scorers !== null &&
        (this.match.winner_draw !== null && this.match.winner_draw !== '') &&
        (!isNaN(statusUpdatedTime) && diffMinutes >= 190);

      if (!isFullyUpdated) {
        const matchTime = new Date(this.match.date).getTime();
        const nowTime = this.today.getTime();

        const finishedStorageKey = `sync_match_${this.match.id}_finished`;
        if ((this.today > matchDate || this.match.status?.toLowerCase() === 'finished') && !localStorage.getItem(finishedStorageKey)) {
          localStorage.setItem(finishedStorageKey, 'true');
          this.predictionService.updateMatchResults(this.match.id.toString()).subscribe({
            next: (res) => {
              console.log(`Automatically updated results for finished match ${this.match.id}`, res);
              this.predictionService.triggerRefresh();
            },
            error: (err) => {
              console.error('Error auto-updating finished match results:', err);
            }
          });
        }

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
  if (!this.canSelectScorer) {
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
    this.forceEnableScorerButton = false;
    this.showTacticalModal = false;
    this.sendBet();
  }

  protected clearScorer(): void {
    if (!this.canEditScores) {
      return;
    }
    this.scorer = '-';
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
    // If one of the inputs changed from null/empty, force both scores to at least 0
    if (this.fullTimeA === null) this.fullTimeA = 0;
    if (this.fullTimeB === null) this.fullTimeB = 0;

    // Force halftime scores to 0 if they are null to prevent them from staying as '-'
    if (this.halfTimeA === null) this.halfTimeA = 0;
    if (this.halfTimeB === null) this.halfTimeB = 0;

    if (this.halfTimeA !== null && this.fullTimeA < this.halfTimeA) {
      this.halfTimeA = this.fullTimeA;
    }
    if (this.halfTimeB !== null && this.fullTimeB < this.halfTimeB) {
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

  get canSelectScorer(): boolean {
    if (this.hidePointsBadge) {
      return false;
    }
    // If a scorer is already chosen (and not empty or '-'), disable the button
    if (this.scorer && this.scorer !== '-' && !this.forceEnableScorerButton) {
      return false;
    }
    return !this.disabled && !this.isSubmitting && (!this.closed || this.isEditing) && !this.hidePointsBadge;
  }

  get canEditScores(): boolean {
    if (this.hidePointsBadge) {
      return false;
    }
    return !this.disabled && !this.isSubmitting && (!this.closed || this.isEditing) &&
      (!this.isSavedInApi || this.isEditing) && !this.hidePointsBadge;
  }

  get isMatchFinishedByDate(): boolean {
    if (!this.match || !this.match.date || !this.today) {
      return false;
    }
    return new Date(this.match.date) < this.today;
  }

  onHalftimeScoreChanged(): void {
    // If one of the inputs changed from null/empty, force both halftime scores to at least 0
    if (this.halfTimeA === null) this.halfTimeA = 0;
    if (this.halfTimeB === null) this.halfTimeB = 0;

    if (this.fullTimeA === null || this.fullTimeA < this.halfTimeA) {
      this.fullTimeA = this.halfTimeA;
    }
    if (this.fullTimeB === null || this.fullTimeB < this.halfTimeB) {
      this.fullTimeB = this.halfTimeB;
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

    const existingDraft = this.predictionService.getDrafts().find(d => String(d.game_id) === String(this.match.id));
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
    if (this.justSaved) return;

    this.predictionService.getMyPredictions(this.match.id).subscribe({
      next: (response) => {
        const drafts = this.predictionService.getDrafts();
        const draft = drafts.find(d => d.game_id === this.match.id);

        const checkPayloadFraud = (pred: any): boolean => {
          if (!pred || !this.match.date) return false;
          const predTimeStr = pred.modified_on || pred.created_on;
          if (!predTimeStr) return false;

          const predTimestamp = new Date(predTimeStr).getTime();
          const matchTimestamp = new Date(this.match.date).getTime();
          this.invalidatedDate = new Date(predTimeStr);

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

            if (Date.parse(this.match.date) > Date.now() && (!this.penaltyWinner || this.penaltyWinner.trim() === '' || this.penaltyWinner === 'Draw')) {
              this.donePronostique.game_id = this.match.id;
              this.predictionService.addDraft(this.donePronostique);
            }
          }

          this.halfTimeA = (response[0].halftime_a !== null && response[0].halftime_a !== undefined && response[0].halftime_a !== '') ? parseInt(response[0].halftime_a, 10) : null;
          this.halfTimeB = (response[0].halftime_b !== null && response[0].halftime_b !== undefined && response[0].halftime_b !== '') ? parseInt(response[0].halftime_b, 10) : null;
          this.scorer = response[0].scorer || '';

          this.hidePointsBadge = checkPayloadFraud(response[0]);

          if (this.hidePointsBadge) {
            this.isSavedInApi = false; 
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

      const status = this.match.current_status?.toLowerCase();
      if (status === 'finished' || this.match.played || diff <= -150 * 60 * 1000) {
        this.countdownText = 'Match terminé';
        if (!this.closed) {
          this.closed = true;
          this.predictionService.removeDraft(this.match.id);
        }
        return;
      }

      if (status === 'live' || status === 'in_play' || diff <= 0) {
        this.countdownText = 'Match commencé';
        if (!this.closed) {
          this.closed = true;
          this.predictionService.removeDraft(this.match.id);
        }
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
    if (this.hidePointsBadge) return false; 
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
    if (this.isScorersJson) {
      scorersList = this.parsedScorersEvents.map(e => e.player?.name).filter(Boolean);
    } else {
      const scorersVal = this.match.scorers;
      if (typeof scorersVal === 'string') {
        scorersList = scorersVal.split(',').map(name => {
          let trimmed = name.trim();
          const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
          const match = trimmed.match(regex);
          return match ? match[1].trim() : trimmed;
        });
      }
    }

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

    const normalizedPredScorer = normalizeName(predScorer);
    const normalizedScorersList = scorersList.map(name => normalizeName(name));

    const fuse = new Fuse(normalizedScorersList, {
      includeScore: true,
      threshold: 0.4
    });

    const results = fuse.search(normalizedPredScorer);
    const isMatch = results.length > 0;

    return isMatch;
  }

  modifierPronostic(): void {
    if (this.match.fulltime_a !== null || this.match.fulltime_b !== null || this.hidePointsBadge) {
      return;
    }

    this.isEditing = true;
    this.disabled = false;
    this.isSavedInApi = false;
    this.forceEnableScorerButton = true;

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
          points += fulltimePts; 
        }
      }

      if (!game.penalty_shootout && this.isFulltimeCorrect()) {
        points += fulltimePts;
      }

      if (this.isHalftimeCorrect()) points += halftimePts;
      if (this.isScorerCorrect()) points += scorerPts;
    }

    return points;
  }

  get isConsolationPointAwarded(): boolean {
    if (!this.donePronostique || !this.match ||
      this.match.fulltime_a === null || this.match.fulltime_b === null || this.hidePointsBadge) {
      return false;
    }
    if (this.match.phase === 'Group Stage' || this.match.phase === 'Round of 32') {
      return false;
    }
    return this.matchPoints === 0;
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

  parseScorers(scorersVal: any): any[] {
    if (!scorersVal) return [];
    let list: any[] = [];
    if (Array.isArray(scorersVal)) {
      list = scorersVal;
    } else if (typeof scorersVal === 'string') {
      const trimmed = scorersVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          list = JSON.parse(trimmed);
        } catch (e) {
          list = [];
        }
      }
    }

    return list.map(e => {
      let name = e.player?.name || e.scorer?.name || e.name || 'Unknown';
      let elapsed = e.time?.elapsed ?? 0;
      let extra = e.time?.extra ?? null;
      let detail = e.detail || 'Normal Goal';

      const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
      const match = typeof name === 'string' ? name.trim().match(regex) : null;
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
        player: { name },
        time: { elapsed, extra },
        detail
      };
    });
  }

  isMatchScorersJson(m: Matches): boolean {
    if (!m || !m.scorers) return false;
    const events = this.parseScorers(m.scorers);
    return events.length > 0;
  }

  getMatchScorersGrouped(m: Matches, teamName: string): any[] {
    if (!m || !m.scorers) return [];
    const events = this.parseScorers(m.scorers);
    if (events.length === 0) return [];

    const teamEvents = events.filter(e => {
      const eventTeam = e.team?.name || e.team;
      return eventTeam && typeof eventTeam === 'string' && eventTeam.trim().toLowerCase() ===
        teamName.trim().toLowerCase();
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

  protected showTeamDetails(teamName: string, event: Event): void {
    event.stopPropagation();
    this.selectedTeamName = teamName;
    this.showTeamInfoModal = true;
    this.loadingTeamInfo = true;

    const loadFlags$ = Object.keys(this.flagsLookup).length > 0
      ? of(null)
      : this.teamService.getFlags().pipe(
        map(flags => {
          (flags || []).forEach((f: any) => {
            this.flagsLookup[f.name] = f.flag_url;
          });
          return null;
        })
      );

    loadFlags$.subscribe(() => {
      this.matchesService.getAllMatches().subscribe({
        next: (allMatches) => {
          this.teamPastMatches = (allMatches || [])
            .filter(m =>
              m.fulltime_a !== null && m.fulltime_b !== null &&
              (m.team_a === teamName || m.team_b === teamName)
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          this.loadingTeamInfo = false;
        },
        error: (err) => {
          console.error('Error fetching past matches:', err);
          this.loadingTeamInfo = false;
        }
      });
    });
  }

  protected getTeamFlagUrl(teamName: string): string {
    return this.flagsLookup[teamName] || 'assets/flags/unknown.png';
  }

  protected getPastMatchesPhases(): typeof PHASE_CONFIG {
    const presentKeys = new Set(this.teamPastMatches.map(m => m.phase));
    return PHASE_CONFIG.filter(p => presentKeys.has(p.key));
  }

  protected getPastMatchesByPhase(phaseKey: string): Matches[] {
    return this.teamPastMatches.filter(m => m.phase === phaseKey);
  }

  protected getMatchResultLabel(pastMatch: Matches): string {
    const isTeamA = pastMatch.team_a === this.selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return 'NUL';
    if (isTeamA) {
      return scoreA > scoreB ? 'VICTOIRE' : 'DÉFAITE';
    } else {
      return scoreB > scoreA ? 'VICTOIRE' : 'DÉFAITE';
    }
  }

  protected getMatchResultColor(pastMatch: Matches): string {
    const isTeamA = pastMatch.team_a === this.selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return '#718096'; 
    if (isTeamA) {
      return scoreA > scoreB ? '#48bb78' : '#e53e3e'; 
    } else {
      return scoreB > scoreA ? '#48bb78' : '#e53e3e'; 
    }
  }

  protected getMatchResultBgColor(pastMatch: Matches): string {
    const isTeamA = pastMatch.team_a === this.selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return 'rgba(113, 128, 150, 0.15)';
    if (isTeamA) {
      return scoreA > scoreB ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)';
    } else {
      return scoreB > scoreA ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)';
    }
  }

  protected getMatchResultTextColor(pastMatch: Matches): string {
    const isTeamA = pastMatch.team_a === this.selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return '#a0aec0';
    if (isTeamA) {
      return scoreA > scoreB ? '#48bb78' : '#f56565';
    } else {
      return scoreB > scoreA ? '#48bb78' : '#f56565';
    }
  }

  formatPlayerName(name: string): string {
    if (!name || name === '-') return name;
    
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      // If the first word is completely uppercase and has letters
      const firstWord = parts[0];
      if (firstWord === firstWord.toUpperCase() && firstWord.match(/[A-Z\u00C0-\u00DC]/)) {
        let i = 0;
        const lastNames = [];
        while (i < parts.length && parts[i] === parts[i].toUpperCase() && parts[i].match(/[A-Z\u00C0-\u00DC]/)) {
          lastNames.push(parts[i]);
          i++;
        }
        
        if (i < parts.length && lastNames.length > 0) {
          const firstNames = parts.slice(i);
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          const formattedLastName = lastNames.map(capitalize).join(' ');
          const formattedFirstName = firstNames.map(capitalize).join(' ');
          
          return `${formattedFirstName} ${formattedLastName}`;
        }
      }
    }
    
    const capitalize = (s: string) => s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    return parts.map(capitalize).join(' ');
  }
}