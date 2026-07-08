import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatchesService } from '../../../core/services/content/matches.service';
import { Matches } from '../../../shared/contracts/matches.contract';
import { GlobaltimeService } from '../../../core/services/core/global-time.service';
import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatchComponent } from '../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { AsyncPipe, DatePipe } from '@angular/common';
import { CalendarStripComponent } from '../../../shared/components/calendar-strip/calendar-strip.component';

@Component({
    selector: 'app-games',
    templateUrl: './games.component.html',
    styleUrl: './games.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatchComponent, LoaderComponent, AsyncPipe, DatePipe, CalendarStripComponent]
})
export class GamesComponent implements OnInit {

  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  protected $today!: Observable<any>;
  protected $matchDates!: Observable<string[]>;
  
  protected selectedTab$ = new BehaviorSubject<'live' | 'upcoming' | 'past' | 'all'>('upcoming');
  protected filterDate$ = new BehaviorSubject<string | null>(null);
  
  protected activeTab: 'live' | 'upcoming' | 'past' | 'all' = 'upcoming';
  protected filterDate: string | null = null;
  protected isCalendarCollapsed: boolean = false;

  ngOnInit(): void {
    this.$today = this.globalTime.getMuTime();

    this.$matchDates = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.selectedTab$
    ]).pipe(
      map(([matches, today, tab]) => {
        const now = new Date(today.dateTime.slice(0, -6));
        const filtered = matches.filter(match => {

          const matchDate = new Date(match.date);
          const isFinished = match.fulltime_a !== null && match.fulltime_b !== null;
          const hasStarted = now >= matchDate;

          if (tab === 'live') {
            return hasStarted && !isFinished;
          } else if (tab === 'upcoming') {
            return !hasStarted && !isFinished;
          } else if (tab === 'past') {
            return isFinished;
          }
          return true;
        });

        const dates = filtered.map(m => m.date.split(' ')[0]);
        return Array.from(new Set(dates)).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      })
    );
    this.$groupedMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.selectedTab$,
      this.filterDate$
    ]).pipe(
      map(([matches, today, tab, filterDate]) => {
        this.activeTab = tab;
        this.filterDate = filterDate;
        const now = new Date(today.dateTime.slice(0, -6));
        
        const filtered = matches.filter(match => {
          
          // If a date filter is selected, check if it matches the match date (YYYY-MM-DD format)
          if (filterDate) {
            const matchDay = match.date.split(' ')[0];
            if (matchDay !== filterDate) {
              return false;
            }
          }

          const matchDate = new Date(match.date);
          const isFinished = match.fulltime_a !== null && match.fulltime_b !== null;
          const hasStarted = now >= matchDate;

          if (tab === 'live') {
            return hasStarted && !isFinished;
          } else if (tab === 'upcoming') {
            return !hasStarted && !isFinished;
          } else if (tab === 'past') {
            return isFinished;
          }
          return true; // 'all'
        });

        const grouped = this.groupMatchesByDate(filtered);

        // Sort matches within each date group by time
        for (const dateKey of Object.keys(grouped)) {
          grouped[dateKey].sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            if (tab === 'past') {
              return timeB - timeA; // Descending (newest first)
            } else {
              return timeA - timeB; // Ascending (earliest first)
            }
          });
        }

        return grouped;
      })
    );
  }

  setTab(tab: 'live' | 'upcoming' | 'past' | 'all'): void {
    this.filterDate$.next(null);
    this.selectedTab$.next(tab);
  }

  onDateFilterChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.value) {
      this.filterDate$.next(input.value);
    } else {
      this.filterDate$.next(null);
    }
  }

  clearDateFilter(): void {
    this.filterDate$.next(null);
  }

  selectDate(date: string | null): void {
    this.filterDate$.next(date);
  }

  groupMatchesByDate(matches: Matches[]): { [key: string]: Matches[] } {
    return matches.reduce((groups, match) => {
      const date = match.date.split(' ')[0]; // Extract the date part only
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(match);
      return groups;
    }, {} as { [key: string]: Matches[] });
  }

  getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches).sort((a, b) => {
      const timeA = new Date(a).getTime();
      const timeB = new Date(b).getTime();
      if (this.activeTab === 'past') {
        return timeB - timeA; // Descending (most recent first)
      } else {
        return timeA - timeB; // Ascending (earliest first)
      }
    });
  }

  getNextDate(dates: string[]): string | null {
    if (!this.filterDate) return null;
    const idx = dates.indexOf(this.filterDate);
    if (idx !== -1 && idx < dates.length - 1) {
      return dates[idx + 1];
    }
    return null;
  }
}
