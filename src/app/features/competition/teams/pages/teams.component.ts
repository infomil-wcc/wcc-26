import { Component, Host, OnInit, Optional, inject, ChangeDetectionStrategy, PLATFORM_ID, computed } from '@angular/core';
import { StateService } from '../../../../core/services/core/state.service';
import { TeamsService } from '../../../../core/services/content/teams.service';
import { Observable, map } from 'rxjs';
import { Teams }  from '../../../../shared/contracts/teams.contract';
import { breadCrump, BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { GlobaltimeService } from '../../../../core/services/core/global-time.service';
import { NgClass, AsyncPipe, isPlatformBrowser } from '@angular/common';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { TeamDetailsComponent } from '../components/team-details/team-details.component';

@Component({
    selector: 'app-teams',
    templateUrl: './teams.component.html',
    styleUrl: './teams.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BreadcrumbComponent, NgClass, LoaderComponent, TeamDetailsComponent]
})

export class TeamsComponent implements OnInit {

  private euroService = inject(TeamsService);
  private globalTime = inject(GlobaltimeService);
  private platformId = inject(PLATFORM_ID);

  protected teamsData = computed(() => {
    const teams = this.euroService.allTeams();
    const cloned = teams.map((t: Teams) => ({ ...t, showDetails: false }));
    return cloned.sort((a: any, b: any) => a.name.localeCompare(b.name));
  });

  protected breadCrumpDefault: breadCrump[] = [{label: 'Les Equipes', route: 'closeTeamDetails', active: true }];

  protected breadCrumpData: breadCrump[] = [];

  protected choosenTeam!: Teams | null;

  protected $today!: Observable<any>;

  ngOnInit(){
    this.$today = this.globalTime.getMuTime();
    this.breadCrumpData = this.breadCrumpDefault;
  }

  showTeam( team: Teams): void {
    this.breadCrumpData = [];
    this.breadCrumpDefault[0].active = false;
    this.breadCrumpData.push(this.breadCrumpDefault[0], {label: team.name, route: '', active: true });
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
    this.choosenTeam = team;
  }

  resetTeamSelection(ev: string): void {
    if(ev === 'closeTeamDetails') {
      this.breadCrumpData = [];
      this.breadCrumpData.push(this.breadCrumpDefault[0]);
      this.choosenTeam = null;
    }
  }

}
