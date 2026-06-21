import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { teamsApiData, Teams, Player, TeamResponse } from '../../../shared/contracts/teams.contract';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { CorrectscorerService, BestPlayer } from '../../../shared/services/games/correctscorer.service';
import { StateService, user } from '../../../shared/services/core/state.service';
import { Observable } from 'rxjs';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LoginComponent } from '../../../shared/components/login/login.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-best-scorer',
    templateUrl: './best-scorer.component.html',
    styleUrl: './best-scorer.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ReactiveFormsModule, FormsModule, NumberInputComponent, LoaderComponent, ModalComponent, LoginComponent, AsyncPipe]
})
export class BestScorerComponent implements OnInit {

  private teamsService = inject(TeamsService);
  private correctScorerService = inject(CorrectscorerService);
  private state = inject(StateService);

  private targetDate = new Date(2026, 5, 11, 22, 55, 0);
  private currentDate = new Date();

  protected $goldenBootPlayers!: Observable<TeamResponse>;
  protected $tournamentPlayers!: Observable<TeamResponse>;
  protected $players!: Observable<teamsApiData[]>;
  protected $teams!: Observable<Teams[]>;
  protected $bestScorer!: Observable<BestPlayer[]>;
  protected disabled: boolean = false;
  protected goldenSelection: boolean = false;
  protected bestSelection: boolean = false;
  protected goldenScorer!: string;
  protected goals: number = 0;
  protected tournamentPlayer!: string;
  protected userId!: string | null;
  protected userName!: string | null;
  protected alreadyPlayed: boolean = false;
  protected userPronostique!: BestPlayer | null;
  protected jeuFermer: boolean = false;

  protected $userState!: Observable<user>;
  protected showLogin: boolean = false;

  ngOnInit(): void {

    // this.currentDate = new Date(2026, 5, 11, 23, 0, 0);
    // console.log(this.targetDate);

    this.state.userState.subscribe({
      next: (res)=>{
        if(res.id){
          this.disabled = false;
          this.userId = res.id;
          this.userName = res.last_name;
          this.checkPlayed();
          this.showLogin = false;
        } else {
          this.disabled = true;
          this.showLogin = true;
        }
      }
    })

    if (this.currentDate < this.targetDate) {
      this.jeuFermer = false;
    }
    else {
      this.jeuFermer = true;
    }
  }

  checkPlayed(){
    this.$bestScorer = this.correctScorerService.getPronostiqueByUser(this.userName);

    this.correctScorerService.getPronostiqueByUser(this.userName).subscribe({
      next: (response) =>{
        if(response.length > 0){
          this.alreadyPlayed = true;
          this.userPronostique = response[0];
        } else {
          this.alreadyPlayed = false;
          this.userPronostique = null;
          this.$teams = this.teamsService.getAllTeams();
        }
      }
    });
  }

  nationalitySelected(event: Event, game: string): void {
    let nation = event.target as HTMLSelectElement;
    if(game === 'goldenBoot'){
      this.$goldenBootPlayers = this.teamsService.getPlayersByTeamName(nation.value);
      this.goldenSelection = true;

    } else {
      this.$tournamentPlayers = this.teamsService.getPlayersByTeamName(nation.value);
      this.bestSelection = true;
      
    }
  }

  validerChoix():void {
    let prediction: BestPlayer  = {
      user: this.userName,
      meilleur_buteur: this.goldenScorer,
      meilleur_joueur: this.tournamentPlayer,
      nombre_but: this.goals,
      status: 'published'
    }

    this.correctScorerService.makePronostique(prediction).subscribe({
      next: (response) => {
        location.reload();
      },
      error: (error) => {
        console.log(error);
      }
    })
  }


}
