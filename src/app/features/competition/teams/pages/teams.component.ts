import { Component, OnInit, inject, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { TeamsFacade } from '../teams.facade';
import { Teams }  from '../../../../shared/contracts/teams.contract';
import { breadCrump, BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { TeamDetailsComponent } from '../components/team-details/team-details.component';
import { TeamListComponent } from '../components/team-list/team-list.component';

@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrl: './teams.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BreadcrumbComponent, LoaderComponent, TeamDetailsComponent, TeamListComponent, AsyncPipe]
})

export class TeamsComponent implements OnInit {

  public facade = inject(TeamsFacade);
  private platformId = inject(PLATFORM_ID);

  protected breadCrumpDefault: breadCrump[] = [{label: 'Les Equipes', route: 'closeTeamDetails', active: true }];
  protected breadCrumpData: breadCrump[] = [];

  ngOnInit(){
    this.breadCrumpData = this.breadCrumpDefault;
  }

  showTeam( team: Teams): void {
    this.breadCrumpData = [];
    this.breadCrumpDefault[0].active = false;
    this.breadCrumpData.push(this.breadCrumpDefault[0], {label: team.name, route: '', active: true });
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
    this.facade.selectTeam(team);
  }

  resetTeamSelection(ev: string): void {
    if(ev === 'closeTeamDetails') {
      this.breadCrumpData = [];
      this.breadCrumpData.push(this.breadCrumpDefault[0]);
      this.facade.clearSelection();
    }
  }

}
