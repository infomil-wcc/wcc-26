import { Component, Input, ChangeDetectionStrategy, Signal } from '@angular/core';
import { Teams } from '@shared/contracts/teams.contract';
import { Matches } from '@shared/contracts/matches.contract';
import { Country } from '@shared/contracts/country.contract';
import { CountryDetailsComponent } from '../country-details/country-details.component';
import { TeamTabsComponent, TeamTabsDirective } from '../team-tabs/team-tabs.component';
import { MatchComponent } from '@shared/components/match/match.component';
import { LoaderComponent } from '@shared/components/loader/loader.component';
import { UpperCasePipe } from '@angular/common';
import { HyphernatePipe } from '@shared/pipe/hyphernate.pipe';

@Component({
  selector: 'team-details',
  templateUrl: './team-details.component.html',
  styleUrl: './team-details.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TeamTabsComponent, TeamTabsDirective, CountryDetailsComponent, MatchComponent, LoaderComponent, UpperCasePipe, HyphernatePipe]
})
export class TeamDetailsComponent {
  @Input() team!: Teams;
  @Input() teamMatches!: Matches[];
  @Input() teamDetails!: Country[];
  @Input() today!: any;
}
