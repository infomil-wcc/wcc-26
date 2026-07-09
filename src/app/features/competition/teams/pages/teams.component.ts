import { Component, Host, OnInit, Optional, inject, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../../../../core/services/core/state.service';
import { TeamsService } from '../../../../../core/services/content/teams.service';
import { Observable, map } from 'rxjs';
import { Teams }  from '../../../../../shared/contracts/teams.contract';
import { breadCrump, BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { GlobaltimeService } from '../../../../../core/services/core/global-time.service';
import { NgClass, AsyncPipe } from '@angular/common';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { TeamDetailsComponent } from '../components/team-details/team-details.component';

@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrl: './teams.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BreadcrumbComponent, NgClass, LoaderComponent, TeamDetailsComponent, AsyncPipe]
})

export class TeamsComponent implements OnInit {

  private euroService = inject(TeamsService);

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
