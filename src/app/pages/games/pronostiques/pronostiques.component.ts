import { Component, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { Observable, forkJoin, of } from 'rxjs';
import { Matches } from '../../../shared/contracts/matches.contract';
import { map, catchError } from 'rxjs/operators';
import { StateService } from '../../../shared/services/core/state.service';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { PredictionsService } from '../../../shared/services/games/predictions.service';
import { NgClass, AsyncPipe, DatePipe } from '@angular/common';
import { MatchComponent } from '../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { tap } from 'rxjs/operators';

@Component({
    selector: 'app-pronostiques',
    templateUrl: './pronostiques.component.html',
    styleUrl: './pronostiques.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
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

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  $playedMatches!: Observable<Matches[]>;

  ngOnInit(): void {

    this.$today = this.globalTime.getMuTime();

    this.$groupedMatches = this.matchesService.getAllMatches().pipe(
      tap(matches => {
        const today = new Date();
        const todayKey = today.toISOString().split('T')[0];
        this.upcomingCount = matches.filter(m => new Date(m.date) >= today).length;
        this.playedCount = matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null).length;
        this.todayMatchCount = matches.filter(m => {
          const d = m.date.split(' ')[0];
          return d === todayKey && m.fulltime_a === null;
        }).length;
      }),
      map(matches => this.groupMatchesByDate(matches))
    );

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
    // Group ALL matches by date (no cutoff) so both tabs can filter from one source
    return matches.reduce((groups, match) => {
      const dateKey = match.date.split(' ')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(match);
      return groups;
    }, {} as { [key: string]: Matches[] });
  }

  /** Returns true if a date group has at least one upcoming (unfinished) match */
  hasUpcoming(matches: Matches[]): boolean {
    return matches.some(m => m.fulltime_a === null && m.fulltime_b === null);
  }

  /** Returns true if a date group has at least one finished match */
  hasPlayed(matches: Matches[]): boolean {
    return matches.some(m => m.fulltime_a !== null && m.fulltime_b !== null);
  }

  /** Count unpredicted matches in a date group */
  unpredictedCount(matches: Matches[]): number {
    return matches.filter(m => m.fulltime_a === null && m.fulltime_b === null).length;
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

  saveAllPredictions(): void {
    const drafts = this.predictionService.getDrafts();
    if (drafts.length === 0 || this.isSubmittingBulk) return;

    this.isSubmittingBulk = true;

    // Prepare bulk requests
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
