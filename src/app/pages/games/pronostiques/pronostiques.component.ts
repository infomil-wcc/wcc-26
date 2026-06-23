import { Component, inject, ChangeDetectorRef, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { Observable, forkJoin, of, BehaviorSubject, combineLatest } from 'rxjs';
import { Matches } from '../../../shared/contracts/matches.contract';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { StateService } from '../../../shared/services/core/state.service';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { PredictionsService } from '../../../shared/services/games/predictions.service';
import { NgClass, AsyncPipe, DatePipe } from '@angular/common';
import { MatchComponent } from '../../../shared/components/match/match.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { CalendarStripComponent } from '../../../shared/components/calendar-strip/calendar-strip.component';

const PHASE_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'Group Stage', label: 'Phase de groupes', icon: 'groups', color: '#3b5bdb' },
  { key: 'Round of 32', label: 'Seizièmes de finale', icon: 'filter_none', color: '#7048e8' },
  { key: 'Round of 16', label: 'Huitièmes de finale', icon: 'filter_8', color: '#9c36b5' },
  { key: 'Quarter-finals', label: 'Quarts de finale', icon: 'emoji_events', color: '#d6336c' },
  { key: 'Semi-finals', label: 'Demi-finales', icon: 'military_tech', color: '#f76707' },
  { key: 'Final', label: 'Finale', icon: 'workspace_premium', color: '#f59f00' },
];

@Component({
  selector: 'app-pronostiques',
  templateUrl: './pronostiques.component.html',
  styleUrl: './pronostiques.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, MatchComponent, LoaderComponent, AsyncPipe, DatePipe, CalendarStripComponent]
})
export class PronostiquesComponent implements OnInit {

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

  protected showTodayBanner: boolean = true;
  protected filterDate: string | null = null;
  protected filterDate$ = new BehaviorSubject<string | null>(null);
  protected activeMatches$ = new BehaviorSubject<boolean>(true);
  protected $matchDates!: Observable<string[]>;

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  $playedMatches!: Observable<Matches[]>;
  totalPoints$!: Observable<{ value: number } | null>;

  ngOnInit(): void {
    this.$today = this.globalTime.getMuTime();

    // Helper function to only allow "published" matches
    const isDraft = (match: Matches) => {
      return match.status === 'draft';
    };

    this.$matchDates = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.activeMatches$
    ]).pipe(
      map(([matches, today, upcoming]) => {
        const now = new Date(today.dateTime.slice(0, -6));
        const filtered = matches.filter(match => {

          // --- FILTER BY STATUS ---
          if (isDraft(match)) return false;

          const isFinished = match.fulltime_a !== null && match.fulltime_b !== null;
          const matchDate = new Date(match.date);
          const hasStarted = now >= matchDate;

          if (upcoming) {
            return !isFinished && !hasStarted;
          } else {
            return isFinished;
          }
        });

        const dates = filtered.map(m => m.date.split(' ')[0]);
        // Sort ascending (earliest first) for upcoming, descending (newest first) for played
        return Array.from(new Set(dates)).sort((a, b) => {
          const timeA = new Date(a).getTime();
          const timeB = new Date(b).getTime();
          return upcoming ? timeA - timeB : timeB - timeA;
        });
      })
    );

    this.$groupedMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.filterDate$
    ]).pipe(
      tap(([matches]) => {
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
      map(([matches, today, filterDate]) => {
        this.filterDate = filterDate;
        const now = new Date(today.dateTime.slice(0, -6));

        // --- FILTER MATCHES HERE ---
        let filtered = matches.filter(match => {

          // 1. Restrict to published only
          if (isDraft(match)) return false;

          // 2. Filter by Active Tab using your class variable (this.activeMatches)
          const isFinished = match.fulltime_a !== null && match.fulltime_b !== null;
          const matchDate = new Date(match.date);
          const hasStarted = now >= matchDate;

          if (this.activeMatches) {
            return !isFinished && !hasStarted; // Upcoming matches
          } else {
            return isFinished; // Played matches
          }
        });

        // 3. Apply calendar date filter if one is selected
        if (filterDate) {
          filtered = filtered.filter(m => m.date.split(' ')[0] === filterDate);
        }
        return this.groupMatchesByDate(filtered);
      })
    );

    // Kept exactly as your original code to preserve predictions mapping inside <app-match>
    this.$playedMatches = this.matchesService.getAllMatches();

    this.stateService.userState.subscribe({
      next: (res) => {
        this.isLoggedIn = !!res.id;
      }
    });

    // ── Total points across all played matches for the logged-in user ────────
    this.totalPoints$ = this.stateService.userState.pipe(
      switchMap(user => {
        if (!user?.id) return of(null);
        return this.matchesService.getAllMatches().pipe(
          switchMap(matches => {
            const played = matches.filter(
              (m: Matches) => m.fulltime_a !== null && m.fulltime_b !== null
            );
            if (played.length === 0) return of({ value: 0 });
            const ids = played.map((m: Matches) => m.id).join(',');
            return this.predictionService.getMyPredictions(`[in]=${ids}`).pipe(
              map((preds: any[]) => {
                let total = 0;
                for (const pred of preds) {
                  const match = played.find(
                    (m: Matches) => String(m.id) === String(pred.game_id)
                  );
                  if (match) total += this.calcMatchPoints(match, pred);
                }
                return { value: total };
              }),
              catchError(() => of({ value: 0 }))
            );
          })
        );
      })
    );

    this.predictionService.drafts$.subscribe(drafts => {
      this.draftsCount = drafts.length;
      this.cdr.detectChanges();
    });
  }

  setActiveTab(upcoming: boolean): void {
    this.activeMatches = upcoming;
    this.filterDate$.next(null);
    this.activeMatches$.next(upcoming);
  }

  selectDate(date: string | null): void {
    this.filterDate$.next(date);
  }

  dismissTodayBanner(): void {
    this.showTodayBanner = false;
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

  isLive(match: Matches, currentMuTimeStr: string): boolean {
    const now = new Date(currentMuTimeStr.slice(0, -6));
    const matchDate = new Date(match.date);
    const isFinished = (match.fulltime_a !== null && match.fulltime_b !== null) || match.fulltime === true;
    const timeDiffMs = now.getTime() - matchDate.getTime();
    const timeDiffMins = timeDiffMs / (1000 * 60);
    return timeDiffMins >= 0 && timeDiffMins < 150 && !isFinished;
  }

  getSortedPlayedMatchesForDate(matches: Matches[]): Matches[] {
    return (matches || [])
      .filter(m => m.fulltime_a !== null && m.fulltime_b !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getPlayedDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches)
      .filter(date => this.hasPlayed(groupedMatches[date]))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  getPlayedCountForDate(matches: Matches[]): number {
    return matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null).length;
  }

  compareDates(date1: string, date2: string): boolean {
    return date1.slice(0, 10) > date2;
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
        // Sort matches by time in ascending order (earliest first)
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

  getNextDate(dates: string[]): string | null {
    if (!this.filterDate) return null;
    const idx = dates.indexOf(this.filterDate);
    if (idx !== -1 && idx < dates.length - 1) {
      return dates[idx + 1];
    }
    return null;
  }

  // ── Per-match point calculation (mirrors RankingcalculationService.calcResult) ──
  private calcMatchPoints(match: Matches, prono: any): number {
    if (match.fulltime_a === null || match.fulltime_b === null) return 0;

    let points = 0;
    const winnerPts   = Number(match.winner_point)   || 0;
    const fulltimePts = Number(match.fulltime_point)  || 0;
    const halftimePts = Number(match.halftime_point)  || 0;
    const scorerPts   = Number(match.scorer_point)    || 0;

    const outcomeCorrect = prono.winner_draw === match.winner_draw;
    const ftA = parseInt(prono.fulltime_a, 10);
    const ftB = parseInt(prono.fulltime_b, 10);
    const fulltimeCorrect = ftA === (match.fulltime_a as number) &&
                            ftB === (match.fulltime_b as number);

    if (match.phase === 'Group Stage') {
      if (outcomeCorrect) points += winnerPts;
      if (String(match.id) === '1' && fulltimeCorrect) points += fulltimePts;
    }

    if (match.phase === 'Round of 16') {
      if (outcomeCorrect) points += winnerPts;
      if (fulltimeCorrect) points += fulltimePts;
    }

    if (['Quarter-finals', 'Semi-finals', 'Final'].includes(match.phase)) {
      if (outcomeCorrect)  points += winnerPts;
      if (fulltimeCorrect) points += fulltimePts;

      if (match.halftime_a !== null && match.halftime_b !== null) {
        const htA = parseInt(prono.halftime_a, 10);
        const htB = parseInt(prono.halftime_b, 10);
        if (htA === (match.halftime_a as number) &&
            htB === (match.halftime_b as number)) {
          points += halftimePts;
        }
      }

      if (prono.scorer && prono.scorer !== '-' && match.scorers) {
        const names = this.extractScorerNames(match.scorers);
        if (names.includes(prono.scorer.trim().toLowerCase())) points += scorerPts;
      }
    }

    return points;
  }

  private extractScorerNames(scorersVal: any): string[] {
    if (!scorersVal) return [];
    let names: string[] = [];
    if (Array.isArray(scorersVal)) {
      names = scorersVal
        .map((e: any) => e.player?.name || e.scorer?.name)
        .filter(Boolean);
    } else if (typeof scorersVal === 'string') {
      const trimmed = scorersVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            names = parsed
              .map((e: any) => e.player?.name || e.scorer?.name)
              .filter(Boolean);
          }
        } catch { /* fall through */ }
      }
      if (names.length === 0) {
        names = trimmed.split(',').map((n: string) => n.trim()).filter(Boolean);
      }
    }
    return names.map((n: string) => n.toLowerCase().trim());
  }
}