import { Component, inject } from '@angular/core';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { Observable } from 'rxjs';
import { Matches } from '../../../shared/contracts/matches.contract';
import { map } from 'rxjs/operators';
import { StateService } from '../../../shared/services/core/state.service';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';

@Component({
  selector: 'app-pronostiques',
  templateUrl: './pronostiques.component.html',
  styleUrl: './pronostiques.component.scss'
})
export class PronostiquesComponent {

  private matchesService = inject(MatchesService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  protected isLoggedIn: boolean = false;
  protected $today!:Observable<any>;
  protected activeMatches: boolean = true;

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  $playedMatches!: Observable<Matches[]>;

  ngOnInit(): void {

    this.$today = this.globalTime.getMuTime();

    this.$groupedMatches = this.matchesService.getAllMatches().pipe(
      map(matches => this.groupMatchesByDate(matches))
    );

    this.$playedMatches = this.matchesService.getAllMatches();

    this.stateService.userState.subscribe({
      next: (res) => {
        this.isLoggedIn = !!res.id;
      }
    });
  }

  groupMatchesByDate(matches: Matches[]): { [key: string]: Matches[] } {
    const now = new Date();
    const daysFromNow = new Date();

    // define here interval on which the matches should appear
    daysFromNow.setDate(now.getDate() + 4);

    return matches.reduce((groups, match) => {
      const matchDate = new Date(match.date);
      if (matchDate <= daysFromNow) {
        const dateKey = match.date.split(' ')[0];
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(match);
      }
      return groups;
    }, {} as { [key: string]: Matches[] });
  }

  getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  getPlayedDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  compareDates(date1: string, date2: string): boolean {
    return date1.slice(0,10) > date2;
  }
}
