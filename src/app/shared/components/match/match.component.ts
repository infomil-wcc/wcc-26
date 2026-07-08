import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { max, Observable, Subscription } from 'rxjs';
import { map, of } from 'rxjs';
import { TeamsService } from '../../../core/services/content/teams.service';
import { StateService } from '../../../core/services/core/state.service';
import { PredictionsService } from '../../../core/services/games/predictions.service';
import { MatchHeaderComponent } from './components/match-header/match-header.component';
import { MatchInfoComponent } from './components/match-info/match-info.component';
import { MatchPredictionEditComponent } from './components/match-prediction-edit/match-prediction-edit.component';
import { MatchPredictionSavedComponent } from './components/match-prediction-saved/match-prediction-saved.component';
import { MatchOfficialScoreComponent } from './components/match-official-score/match-official-score.component';
import { TeamInfoModalComponent } from './components/team-info-modal/team-info-modal.component';
import { MatchScorersService } from '../../../core/services/games/match-scorers.service';
import { MatchOutcomeService } from '../../../core/services/games/match-outcome.service';
import { MatchCountdownService } from '../../../core/services/games/match-countdown.service';
import { TeamHistoryService, PHASE_CONFIG } from '../../../core/services/games/team-history.service';
import { GlobaltimeService } from '../../../core/services/core/global-time.service';
import { StadiumsService } from '../../../core/services/content/stadiums.service';
import { NgClass, NgStyle } from '@angular/common';
import { LoaderComponent } from '../loader/loader.component';
import { TacticalLineupComponent } from '../tactical-lineup/tactical-lineup.component';
import { LineupsApiService } from '../../../core/services/api/lineups-api.service';

import { MatchesService } from '../../../core/services/content/matches.service';



@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, NgStyle, LoaderComponent, TacticalLineupComponent, MatchHeaderComponent, MatchInfoComponent, MatchPredictionEditComponent, MatchPredictionSavedComponent, MatchOfficialScoreComponent, TeamInfoModalComponent]
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
  matchScorersService = inject(MatchScorersService);
  matchOutcomeService = inject(MatchOutcomeService);
  matchCountdownService = inject(MatchCountdownService);
  teamHistoryService = inject(TeamHistoryService);

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

  closeTacticalLineup(): void {
    this.showTacticalModal = false;
  }

  selectScorer(scorer: string): void {
    if (!this.canEditScores) {
      return;
    }
    this.scorer = scorer;
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
      this.matchOutcome = this.matchOutcomeService.calculateWinDraw(this.match.phase, this.penaltyWinner, this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
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
    return this.matchOutcomeService.isMatchFinishedByDate(this.match?.date, this.today);
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
      this.matchOutcome = this.matchOutcomeService.calculateWinDraw(this.match.phase, this.penaltyWinner, this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
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
      currentOutcome = this.matchOutcomeService.calculateWinDraw(this.match.phase, this.penaltyWinner, this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
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

          let normalizedMatchDate = this.match.date.trim();
          if (!normalizedMatchDate.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalizedMatchDate)) {
            normalizedMatchDate += '+04:00';
          }
          normalizedMatchDate = normalizedMatchDate.replace(' ', 'T');

          const predTimestamp = new Date(predTimeStr).getTime();
          const matchTimestamp = new Date(normalizedMatchDate).getTime();
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
    const updateCountdown = () => {
      const state = this.matchCountdownService.getCountdownState(this.match.date, this.match.current_status, this.match.played, this.timeOffset);
      this.countdownText = state.text;
      if (state.isClosed && !this.closed) {
        this.closed = true;
        this.predictionService.removeDraft(this.match.id);
      }
    };

    updateCountdown();
    this.countdownIntervalId = setInterval(updateCountdown, 1000);
  }

  isOutcomeCorrect(): boolean {
    return this.matchOutcomeService.isOutcomeCorrect(this.donePronostique, this.match, this.hidePointsBadge);
  }

  isFulltimeCorrect(): boolean {
    return this.matchOutcomeService.isFulltimeCorrect(this.donePronostique, this.match, this.hidePointsBadge);
  }

  isHalftimeCorrect(): boolean {
    return this.matchOutcomeService.isHalftimeCorrect(this.donePronostique, this.match, this.hidePointsBadge);
  }

  get isScorersJson(): boolean {
    return this.matchScorersService.isMatchScorersJson(this.match);
  }

  isScorerCorrect(): boolean {
    return this.matchScorersService.isScorerCorrect(this.donePronostique?.scorer, this.match);
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
    return this.matchOutcomeService.getMatchPoints(this.donePronostique, this.match, this.hidePointsBadge);
  }

  get isConsolationPointAwarded(): boolean {
    return this.matchOutcomeService.isConsolationPointAwarded(this.donePronostique, this.match, this.hidePointsBadge);
  }

  get teamAScorersGrouped(): any[] {
    return this.matchScorersService.getMatchScorersGrouped(this.match, this.match.team_a);
  }

  get teamBScorersGrouped(): any[] {
    return this.matchScorersService.getMatchScorersGrouped(this.match, this.match.team_b);
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

  closeTeamInfoModal(): void {
    this.showTeamInfoModal = false;
    this.selectedTeamName = '';
    this.teamPastMatches = [];
  }

  protected getTeamFlagUrl(teamName: string): string {
    return this.flagsLookup[teamName] || 'assets/flags/unknown.png';
  }


}