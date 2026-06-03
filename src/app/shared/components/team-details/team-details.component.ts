import { Component, Input, OnInit, inject } from '@angular/core';
import { Teams, Players } from '../../contracts/teams.contract';
import { Matches } from '../../contracts/matches.contract';
import { TeamsService } from '../../services/content/teams.service';
import { MatchesService } from '../../services/content/matches.service';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Country } from '../country-details/country-details.component';

@Component({
  selector: 'team-details',
  templateUrl: './team-details.component.html',
  styleUrl: './team-details.component.scss'
})
export class TeamDetailsComponent implements OnInit {

  @Input() team!: Teams;

  private teamsService = inject(TeamsService);
  private matchesService = inject(MatchesService);

  $teamMatches!: Observable<Matches[]>;
  $teamPlayers!: Observable<Players[]>;
  $teamDetails!: Observable<Country[]>;

  ngOnInit(): void {
    this.$teamPlayers = this.teamsService.getPlayersByTeamName(this.team.name);
    this.$teamMatches = this.matchesService.getMatchesByTeam(this.team.name);
        this.$teamDetails = this.teamsService.getTeamsInfo(this.team.iso).pipe(
      map((countries: Country[]) => {
        return countries.map(country => {
          if (country.timeline) {
            country.timeline.sort((a, b) => a.year - b.year);
          }
          return country;
        });
      })
    );
  }

}
