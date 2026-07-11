import { Component, OnInit, inject, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { TeamsFacade } from '../teams.facade';
import { Teams }  from '../../../../shared/contracts/teams.contract';
import { NgClass, AsyncPipe, isPlatformBrowser } from '@angular/common';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { TeamDetailsComponent } from '../components/team-details/team-details.component';
import { TeamListComponent } from '../components/team-list/team-list.component';

@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrl: './teams.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass, LoaderComponent, TeamDetailsComponent, TeamListComponent, AsyncPipe]
})

export class TeamsComponent implements OnInit {

  public facade = inject(TeamsFacade);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(){
  }

  showTeam(team: Teams): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
    this.facade.selectTeam(team);
  }
}
