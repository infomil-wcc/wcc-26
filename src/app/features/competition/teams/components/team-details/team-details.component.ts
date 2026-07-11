import { Component, Input, ChangeDetectionStrategy, Signal } from '@angular/core';
import { Teams, teamsApiData } from '../../../../../shared/contracts/teams.contract';
import { Matches } from '../../../../../shared/contracts/matches.contract';
import { Observable } from 'rxjs';
import { Country, CountryDetailsComponent } from '../country-details/country-details.component';
import { TabContentComponent, TabContentDirective } from '../tab-content/tab-content.component';
import { MatchComponent } from '../../../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../../../shared/components/loader/loader.component';
import { UpperCasePipe } from '@angular/common';
import { HyphernatePipe } from '../../../../../shared/pipe/hyphernate.pipe';

@Component({
    selector: 'team-details',
    templateUrl: './team-details.component.html',
    styleUrl: './team-details.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [TabContentComponent, TabContentDirective, CountryDetailsComponent, MatchComponent, LoaderComponent, UpperCasePipe, HyphernatePipe]
})
export class TeamDetailsComponent {
  @Input() team!: Teams;
  @Input() teamMatches!: Matches[];
  @Input() teamDetails!: Country[];
  @Input() today!: any;
}
