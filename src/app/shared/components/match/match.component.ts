import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { Observable } from 'rxjs';
import { Player } from '../../contracts/teams.contract';
import { TeamsService } from '../../services/content/teams.service';
import { StateService } from '../../services/core/state.service';
import { Pronostiques } from '../../contracts/pronostiques.contract';
import { PredictionsService } from '../../services/games/predictions.service';
import { GlobaltimeService } from '../../services/core/globaltime.service';
import { StadiumsService } from '../../services/content/stadiums.service';

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss'
})
export class MatchComponent implements OnInit, OnDestroy{

  teamService = inject(TeamsService);
  predictionService = inject(PredictionsService);
  stateService = inject(StateService);
  globalTime = inject(GlobaltimeService);
  stadiumsService = inject(StadiumsService);

  @Input() match!: Matches;
  @Input() isPronostiques: boolean = false;
  @Input() disabled: boolean = false;
  @Input() dateTime!: string;
  @Input() hasPlayed!: boolean;
  @Output() hasPlayedChange = new EventEmitter<boolean>;

  protected showLoader: boolean = false;
  protected pronostiqueDone: boolean = false;

  protected userId: number = 0;
  protected userTrigramme: string = '';
  protected halfTimeA: number = 0;
  protected halfTimeB: number = 0;
  protected fullTimeA: number = 0;
  protected fullTimeB: number = 0;
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
  protected $players!: Observable<Player[]>;
  protected donePronostique!: any;
  protected showPronostiqueModal = false;
  protected isSubmitting = false;
  protected isEditing = false;


  ngOnInit(): void {

    this.today = new Date(this.dateTime.slice(0,-6));
    const serverTime = this.today.getTime();
    const localTime = new Date().getTime();
    this.timeOffset = serverTime - localTime;

    this.stateService.userState.subscribe({
      next:(response)=> {
        if(response.id !== null) {
          (response.id)? this.userId = parseInt(response.id) : "";
          (response.last_name)? this.userTrigramme = response.last_name : "";
          if(this.isPronostiques){
            this.verfierMonPronostique();
          }
        }
      }
    })

    if(this.isPronostiques && this.userId !== 0){
      this.verfierMonPronostique();
    }

    let matchDate = new Date(this.match.date)
    this.limitDate = this.subtractHours(matchDate);

    if(this.today > this.limitDate) {
      this.closed = true;

      if(this.match.fulltime_a === null || this.match.fulltime_b === null) {
        console.log('match finished but result not updated');
        // this.predictionService.updateResults();
      }
    }

    this.getTeamFlag(this.match.team_a, (flag: string) => this.teamAFlag = flag);
    this.getTeamFlag(this.match.team_b, (flag: string) => this.teamBFlag = flag);
    this.getStadiumImage();
    this.startCountdown();

    if (this.match.fulltime) {
      this.calcWinDrawOutcome = true;
    }

    // Forcing for testing 
    // this.match.fulltime_a = 1;
    // this.match.fulltime_b = 2;
    // this.match.winner_draw = this.match.team_b;
  }

  ngOnDestroy(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
    }
  }

  subtractHours(date: Date): Date {
    const newDate = new Date(date);
    // 5mins
    newDate.setTime(newDate.getTime() - (5 * 60 * 1000));
    return newDate;
  }

  nationalitySelected(ev: Event):void {
    let selectBox = ev.target as HTMLSelectElement;
    this.$players = this.teamService.getPlayersByTeamName(selectBox.value);
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
    if (this.calcWinDrawOutcome) {
      this.matchOutcome = this.calculateWinDraw(this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
    }
    this.sendBet();
  }

  selectWinner(outcome: string): void {
    if (this.disabled || this.isSubmitting || this.closed || this.isSavedInApi) {
      return;
    }
    this.matchOutcome = outcome;
    this.sendBet();
  }

  sendBet(){
    let currentOutcome = this.matchOutcome;

    if(this.calcWinDrawOutcome){
      currentOutcome = this.calculateWinDraw( this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
    }

    let prediction: any = {
      user: this.userTrigramme,
      game_id: this.match.id,
      halftime_a: this.halfTimeA?.toString(),
      halftime_b: this.halfTimeB?.toString(),
      fulltime_a: this.fullTimeA?.toString(),
      fulltime_b: this.fullTimeB?.toString(),
      scorer: this.scorer,
      winner_draw: currentOutcome,
    }

    if (this.donePronostique && this.donePronostique.id) {
      prediction.id = this.donePronostique.id;
    }

    this.predictionService.addDraft(prediction);

    this.pronostiqueDone = true;
    this.donePronostique = prediction;
    if (!this.isEditing) {
      this.isEditing = false;
    }
    this.showLoader = false;
    this.isSubmitting = false;
  }

  calculateWinDraw(teamA: string, teamB: string, scoreA: number, scoreB: number): string {
    let outcome: string;

    (scoreA > scoreB)? outcome = teamA : outcome = teamB;
    (scoreA === scoreB )? outcome = 'Draw': '';

    return outcome;
  }

  verfierMonPronostique(): void {
    this.predictionService.getMyPredictions(this.match.id).subscribe({
      next: (response)=> {
        const drafts = this.predictionService.getDrafts();
        const draft = drafts.find(d => d.game_id === this.match.id);

        if (draft) {
          this.pronostiqueDone = true;
          this.donePronostique = draft;
          this.matchOutcome = draft.winner_draw;
          this.fullTimeA = draft.fulltime_a ? parseInt(draft.fulltime_a, 10) : 0;
          this.fullTimeB = draft.fulltime_b ? parseInt(draft.fulltime_b, 10) : 0;
          this.halfTimeA = draft.halftime_a ? parseInt(draft.halftime_a, 10) : 0;
          this.halfTimeB = draft.halftime_b ? parseInt(draft.halftime_b, 10) : 0;
          this.scorer = draft.scorer || '';
          this.isSavedInApi = response.length > 0;
        } else if(response.length > 0){
          this.pronostiqueDone = true;
          this.isSavedInApi = true;
          this.donePronostique = response[0];
          this.matchOutcome = response[0].winner_draw;
          this.fullTimeA = response[0].fulltime_a ? parseInt(response[0].fulltime_a, 10) : 0;
          this.fullTimeB = response[0].fulltime_b ? parseInt(response[0].fulltime_b, 10) : 0;
          this.halfTimeA = response[0].halftime_a ? parseInt(response[0].halftime_a, 10) : 0;
          this.halfTimeB = response[0].halftime_b ? parseInt(response[0].halftime_b, 10) : 0;
          this.scorer = response[0].scorer || '';
        } else {
          this.pronostiqueDone = false;
          this.donePronostique = [];
          this.isSavedInApi = false;
        }
      }
    })
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

      if (this.match.fulltime_a !== null && this.match.fulltime_b !== null) {
        this.countdownText = 'Match terminé';
        return;
      }

      if (diff <= 0) {
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
}
