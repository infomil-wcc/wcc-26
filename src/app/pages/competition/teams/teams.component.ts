import { Component, Host, OnInit, Optional, inject } from '@angular/core';
import { StateService } from '../../../shared/services/core/state.service';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { Observable, map } from 'rxjs';
import { Teams }  from '../../../shared/contracts/teams.contract';
import { breadCrump } from '../../../shared/components/breadcrump/breadcrump.component';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';

@Component({
  selector: 'app-teams',
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})

export class TeamsComponent implements OnInit {

  private euroService = inject(TeamsService);

  private stateService = inject(StateService);

  private globalTime = inject(GlobaltimeService);

  protected $teamsData?: Observable<Teams[]>;

  protected breadCrumpDefault: breadCrump[] = [{label: 'Les Equipes', route: 'closeTeamDetails', active: true }];

  protected breadCrumpData: breadCrump[] = [];

  protected choosenTeam!: Teams | null;

  protected $today!: Observable<any>;

  ngOnInit(){
    this.$today = this.globalTime.getMuTime();
    this.breadCrumpData = this.breadCrumpDefault;
    this.setTeamsData();
  }

  setTeamsData(): void {
    this.$teamsData = this.euroService.getAllTeams().pipe(
      map((teams: Teams[]) => {
        teams.forEach(team => team.showDetails = false);
        // Sorting details of teams by team name
        return teams.sort((a, b) => a.name.localeCompare(b.name));
      })
    )
  }

  showTeam( team: Teams): void {
    this.breadCrumpData = [];
    this.breadCrumpDefault[0].active = false;
    this.breadCrumpData.push(this.breadCrumpDefault[0], {label: team.name, route: '', active: true });
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    this.choosenTeam = team;
  }

  resetTeamSelection(ev: string): void {
    if(ev === 'closeTeamDetails') {
      this.breadCrumpData = [];
      this.breadCrumpData.push(this.breadCrumpDefault[0]);
      this.setTeamsData();
      this.choosenTeam = null;
    }
  }

}
