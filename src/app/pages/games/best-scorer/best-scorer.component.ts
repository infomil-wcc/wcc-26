import { Component, OnInit, inject } from '@angular/core';
import { Players, Teams } from '../../../shared/contracts/teams.contract';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { CorrectscorerService, BestPlayer } from '../../../shared/services/games/correctscorer.service';
import { StateService } from '../../../shared/services/core/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-best-scorer',
  templateUrl: './best-scorer.component.html',
  styleUrl: './best-scorer.component.scss'
})
export class BestScorerComponent implements OnInit {

  private teamsService = inject(TeamsService);
  private correctScorerService = inject(CorrectscorerService);
  private state = inject(StateService);

  private targetDate = new Date(2024, 5, 14, 22, 45, 0);
  private currentDate = new Date();

  protected $goldenBootPlayers!: Observable<Players[]>;
  protected $tournamentPlayers!: Observable<Players[]>;
  protected $players!: Observable<Players[]>;
  protected $teams!: Observable<Teams[]>;
  protected $bestScorer!: Observable<BestPlayer[]>;
  protected disabled: boolean = false;
  protected goldenScorer!: string;
  protected goals: number = 0;
  protected tournamentPlayer!: string;
  protected userId!: string | null;
  protected userName!: string | null;
  protected alreadyPlayed: boolean = false;
  protected userPronostique!: BestPlayer | null;
  protected jeuFermer: boolean = false;

  ngOnInit(): void {

    // this.currentDate = new Date(2024, 5, 14, 23, 0, 0);

    this.state.userState.subscribe({
      next: (res)=>{
        if(res.id){
          this.disabled = false;
          this.userId = res.id;
          this.userName = res.last_name;
          this.checkPlayed();
        } else {
          this.disabled = true;
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
    } else {
      this.$tournamentPlayers = this.teamsService.getPlayersByTeamName(nation.value);
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
