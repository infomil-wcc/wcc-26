import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';
import { MatchComponent } from '../../../shared/components/match/match.component';

@Component({
    selector: 'app-statistics',
    imports: [MatchComponent],
    templateUrl: './statistics.component.html',
    styleUrl: './statistics.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class StatisticsComponent {

  public today = new Date().toString();

  public isLoggedIn = true;

  public mymatch: Matches = {
    id: '89',
    status: 'published',
    sort: null,
    owner: 1,
    created_on: '2025-10-01T00:00:00Z',
    modified_by: 1,
    modified_on: '2025-10-01T00:00:00Z',
    phase: 'Round of 16',
    date: '06/28/2026 23:00:00',
    group: '',
    team_a: 'Portugal',
    team_b: 'France',
    played: false,
    halftime_a: null,
    halftime_b: null,
    fulltime_a: null,
    fulltime_b: null,
    scorers: null,
    winner_point: 1,
    fulltime_point: 1,
    halftime_point: 1,
    scorer_point: 1,
    stadium: 'Los Angeles Stadium',
    fulltime: true,
    halftime: true,
    scorer: true,
    penalty_a: null,
    penalty_b: null,
    penalty_shootout: null,
    winner_draw: null
  }


}
