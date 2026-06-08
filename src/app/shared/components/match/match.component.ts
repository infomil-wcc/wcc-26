import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Matches } from '../../contracts/matches.contract';
import { Observable } from 'rxjs';
import { Player } from '../../contracts/teams.contract';
import { TeamsService } from '../../services/content/teams.service';
import { StateService } from '../../services/core/state.service';
import { Pronostiques } from '../../contracts/pronostiques.contract';
import { PredictionsService } from '../../services/games/predictions.service';
import { GlobaltimeService } from '../../services/core/globaltime.service';

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrl: './match.component.scss'
})
export class MatchComponent implements OnInit{

  teamService = inject(TeamsService);
  predictionService = inject(PredictionsService);
  stateService = inject(StateService);
  globalTime = inject(GlobaltimeService);

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
  protected $players!: Observable<Player[]>;
  protected donePronostique!: any;


  ngOnInit(): void {

    this.today = new Date(this.dateTime.slice(0,-6));

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
    }

    this.getTeamFlag(this.match.team_a, (flag: string) => this.teamAFlag = flag);
    this.getTeamFlag(this.match.team_b, (flag: string) => this.teamBFlag = flag);

  }

  subtractHours(date: Date): Date {
    const newDate = new Date(date);
    // 15mins
    newDate.setTime(newDate.getTime() - (1 * 15 * 60 * 1000));
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

  sendBet(){
    this.globalTime.getMuTime().subscribe({
      next: (res: any)=>{
        let currentDate = new Date(res.dateTime.slice(0,-6));

        if(currentDate < this.limitDate ) {
          let currentOutcome = this.matchOutcome;
          this.showLoader = true;

          if(this.calcWinDrawOutcome){
            currentOutcome = this.calculateWinDraw( this.match.team_a, this.match.team_b, this.fullTimeA, this.fullTimeB);
          }

          let prediction = {
            user: this.userTrigramme,
            game_id: this.match.id,
            halftime_a: this.halfTimeA?.toString(),
            halftime_b: this.halfTimeB?.toString(),
            fulltime_a: this.fullTimeA?.toString(),
            fulltime_b: this.fullTimeB?.toString(),
            scorer: this.scorer,
            winner_draw: currentOutcome,
          }

          this.predictionService.sendPrediction(prediction).subscribe({
            next:()=>{
              location.reload();
            },
            error:(error)=>{
              console.log(error);
              location.reload();
              this.showLoader = false;
            }
          })
        } else {
          location.reload();
        }
      }
    })

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
        if(response.length > 0){
          this.pronostiqueDone = true;
          this.donePronostique = response[0];
        } else {
          this.pronostiqueDone = false;
          this.donePronostique = [];
        }
      }
    })
  }
}
