import { Component, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { Observable, forkJoin, of } from 'rxjs';
import { Matches } from '../../../shared/contracts/matches.contract';
import { map, catchError, tap } from 'rxjs/operators';
import { StateService } from '../../../shared/services/core/state.service';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { PredictionsService } from '../../../shared/services/games/predictions.service';
import { NgClass, AsyncPipe, DatePipe } from '@angular/common';
import { MatchComponent } from '../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

const PHASE_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'Group Stage',    label: 'Phase de groupes',    icon: 'groups',           color: '#3b5bdb' },
  { key: 'Round of 32',   label: 'Seizièmes de finale',  icon: 'filter_none',       color: '#7048e8' },
  { key: 'Round of 16',   label: 'Huitièmes de finale',  icon: 'filter_8',          color: '#9c36b5' },
  { key: 'Quarter-finals',label: 'Quarts de finale',     icon: 'emoji_events',      color: '#d6336c' },
  { key: 'Semi-finals',   label: 'Demi-finales',         icon: 'military_tech',     color: '#f76707' },
  { key: 'Final',         label: 'Finale',               icon: 'workspace_premium', color: '#f59f00' },
];

@Component({
    selector: 'app-pronostiques',
    templateUrl: './pronostiques.component.html',
    styleUrl: './pronostiques.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush, // Fixed compilation error
    imports: [NgClass, MatchComponent, LoaderComponent, AsyncPipe, DatePipe]
})
export class PronostiquesComponent {

  private matchesService = inject(MatchesService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private predictionService = inject(PredictionsService);
  private cdr = inject(ChangeDetectorRef);

  protected isLoggedIn: boolean = false;
  protected $today!: Observable<any>;
  protected activeMatches: boolean = true;
  protected draftsCount: number = 0;
  protected isSubmittingBulk: boolean = false;
  protected upcomingCount: number = 0;
  protected playedCount: number = 0;
  protected todayMatchCount: number = 0;     
  protected todayTotalCount: number = 0;     
  protected todayPlayedCount: number = 0;    
  protected todayPredictedCount: number = 0; 

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  $playedMatches!: Observable<Matches[]>;

  ngOnInit(): void {
    this.$today = this.globalTime.getMuTime();

    this.$groupedMatches = this.matchesService.getAllMatches().pipe(
      tap(matches => {
        const today = new Date();
        const todayKey = today.toISOString().split('T')[0];
        this.upcomingCount = matches.filter(m => m.fulltime_a === null && m.fulltime_b === null).length;
        this.playedCount = matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null).length;

        const todayMatches = matches.filter(m => m.date.split(' ')[0] === todayKey);
        this.todayTotalCount = todayMatches.length;
        this.todayPlayedCount = todayMatches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null).length;
        this.todayMatchCount = todayMatches.filter(m => m.fulltime_a === null).length;

        const unplayedToday = todayMatches.filter(m => m.fulltime_a === null);
        if (unplayedToday.length > 0 && this.isLoggedIn) {
          const ids = unplayedToday.map(m => m.id).join(',');
          this.predictionService.getMyPredictions(`[_in]=${ids}`).subscribe({
            next: (preds: any[]) => {
              this.todayPredictedCount = preds.length;
              this.cdr.detectChanges();
            },
            error: () => { this.todayPredictedCount = 0; }
          });
        } else {
          this.todayPredictedCount = 0;
        }
      }),
      map(matches => this.groupMatchesByDate(matches))
    );

    // Kept exactly as your original code to preserve predictions mapping inside <app-match>
    this.$playedMatches = this.matchesService.getAllMatches();

    this.stateService.userState.subscribe({
      next: (res) => {
        this.isLoggedIn = !!res.id;
      }
    });

    this.predictionService.drafts$.subscribe(drafts => {
      this.draftsCount = drafts.length;
      this.cdr.detectChanges();
    });
  }

  groupMatchesByDate(matches: Matches[]): { [key: string]: Matches[] } {
    return matches.reduce((groups, match) => {
      const dateKey = match.date.split(' ')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(match);
      return groups;
    }, {} as { [key: string]: Matches[] });
  }

  hasUpcoming(matches: Matches[]): boolean {
    return matches.some(m => m.fulltime_a === null && m.fulltime_b === null);
  }

  hasPlayed(matches: Matches[]): boolean {
    return matches.some(m => m.fulltime_a !== null && m.fulltime_b !== null);
  }

  unpredictedCount(matches: Matches[]): number {
    return matches.filter(m => m.fulltime_a === null && m.fulltime_b === null).length;
  }

  getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  // Updated to include today if any match has been played, without breaking object schemas
  getPlayedDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches)
      .filter(date => this.hasPlayed(groupedMatches[date]))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  getPlayedCountForDate(matches: Matches[]): number {
    return matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null).length;
  }

  compareDates(date1: string, date2: string): boolean {
    return date1.slice(0,10) > date2;
  }

  getUpcomingPhases(groupedMatches: { [key: string]: Matches[] }): typeof PHASE_CONFIG {
    const allUpcoming = Object.values(groupedMatches).flat()
      .filter(m => m.fulltime_a === null && m.fulltime_b === null);
    const presentKeys = new Set(allUpcoming.map(m => m.phase));
    return PHASE_CONFIG.filter(p => presentKeys.has(p.key));
  }

  getMatchesByPhaseAndDate(
    groupedMatches: { [key: string]: Matches[] },
    phaseKey: string
  ): { date: string; matches: Matches[] }[] {
    const byDate: { [date: string]: Matches[] } = {};
    const dates = this.getDates(groupedMatches);
    for (const date of dates) {
      const filtered = (groupedMatches[date] || [])
        .filter(m => m.phase === phaseKey && m.fulltime_a === null && m.fulltime_b === null);
      if (filtered.length > 0) {
        byDate[date] = filtered;
      }
    }
    return Object.entries(byDate)
      .map(([date, matches]) => ({ date, matches }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  saveAllPredictions(): void {
    const drafts = this.predictionService.getDrafts();
    if (drafts.length === 0 || this.isSubmittingBulk) return;

    this.isSubmittingBulk = true;

    const requests = drafts.map(draft =>
      this.predictionService.sendPrediction(draft).pipe(
        catchError(err => {
          console.error('Failed to send prediction for game:', draft.game_id, err);
          return of(null);
        })
      )
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.predictionService.clearDrafts();
        this.isSubmittingBulk = false;
        location.reload();
      },
      error: (err) => {
        console.error('Error during bulk submit:', err);
        this.isSubmittingBulk = false;
      }
    });
  }

  cancelAllDrafts(): void {
    this.predictionService.clearDrafts();
    location.reload();
  }
}