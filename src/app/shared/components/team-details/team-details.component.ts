import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Teams, TeamResponse, teamsApiData } from '../../contracts/teams.contract';
import { Matches } from '../../contracts/matches.contract';
import { TeamsService } from '../../services/content/teams.service';
import { MatchesService } from '../../services/content/matches.service';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Country } from '../country-details/country-details.component';
import { GlobaltimeService } from '../../services/core/globaltime.service';

@Component({
    selector: 'team-details',
    templateUrl: './team-details.component.html',
    styleUrl: './team-details.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamDetailsComponent implements OnInit {

  @Input() team!: Teams;

  private teamsService = inject(TeamsService);
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);

  protected $today!:Observable<any>;

  $teamMatches!: Observable<Matches[]>;
  $teamPlayers!: Observable<teamsApiData[]>;
  $teamDetails!: Observable<Country[]>;

  ngOnInit(): void {

    this.$today = this.globalTime.getMuTime();

    // this.$teamPlayers = this.teamsService.getPlayersByTeamName(this.team.name);
    this.$teamMatches = this.matchesService.getMatchesByTeam(this.team.name);
        this.$teamDetails = this.teamsService.getTeamsInfo(this.team.iso).pipe(
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
