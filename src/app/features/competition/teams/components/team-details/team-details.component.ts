import { Component, Input, OnInit, inject, ChangeDetectionStrategy, Injector } from '@angular/core';
import { Teams, TeamResponse, teamsApiData } from '../../../../../shared/contracts/teams.contract';
import { Matches } from '../../../../../shared/contracts/matches.contract';
import { toObservable } from '@angular/core/rxjs-interop';
import { TeamsService } from '../../../../../core/services/content/teams.service';
import { MatchesService } from '../../../../../core/services/content/matches.service';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Country, CountryDetailsComponent } from '../country-details/country-details.component';
import { GlobaltimeService } from '../../../../../core/services/core/global-time.service';
import { TabContentComponent, TabContentDirective } from '../tab-content/tab-content.component';
import { MatchComponent } from '../../../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { HyphernatePipe } from '../../../../../shared/pipe/hyphernate.pipe';

@Component({
    selector: 'team-details',
    templateUrl: './team-details.component.html',
    styleUrl: './team-details.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [TabContentComponent, TabContentDirective, CountryDetailsComponent, MatchComponent, LoaderComponent, AsyncPipe, UpperCasePipe, HyphernatePipe]
})
export class TeamDetailsComponent implements OnInit {

  @Input() team!: Teams;

  private teamsService = inject(TeamsService);
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);
  private injector = inject(Injector);

  protected $today!:Observable<any>;

  $teamMatches!: Observable<Matches[]>;
  $teamPlayers!: Observable<teamsApiData[]>;
  $teamDetails!: Observable<Country[]>;

  ngOnInit(): void {

    this.$today = this.globalTime.getMuTime();

    // this.$teamPlayers = this.teamsService.getPlayersByTeamName(this.team.name);
    this.$teamMatches = toObservable(this.matchesService.getMatchesByTeam(this.team.name), { injector: this.injector });
    this.$teamDetails = toObservable(this.teamsService.getTeamsInfo(this.team.iso), { injector: this.injector }).pipe(
      map((countries: Country[]) => {
        return countries.map(country => {
          if (country.timeline) {
            country.timeline.sort((a, b) => b.year - a.year);
          }
          return country;
        });
      })
    );
  }

}
