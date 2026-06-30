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
import { RankingsService } from '../../../shared/services/content/rankings.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LoginComponent } from '../../../shared/components/login/login.component';

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
  imports: [NgClass, MatchComponent, LoaderComponent, AsyncPipe, DatePipe, CalendarStripComponent, ModalComponent, LoginComponent]
})
export class PronostiquesComponent implements OnInit {

  private matchesService = inject(MatchesService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private predictionService = inject(PredictionsService);
  private rankingsService = inject(RankingsService);
  private cdr = inject(ChangeDetectorRef);

  protected isLoggedIn: boolean = false;
  protected $today!: Observable<any>;
  protected activeTab: 'live' | 'upcoming' | 'played' = 'upcoming';
  protected draftsCount: number = 0;
  protected isSubmittingBulk: boolean = false;
  protected liveCount: number = 0;
  protected upcomingCount: number = 0;
  protected playedCount: number = 0;
  protected todayMatchCount: number = 0;
  protected todayTotalCount: number = 0;
  protected todayPlayedCount: number = 0;
  protected todayPredictedCount: number = 0;

  protected showLockPopup: boolean = false;
  protected lockedMatchName: string = '';

  protected showTodayBanner: boolean = true;
  protected filterDate: string | null = null;
  protected filterDate$ = new BehaviorSubject<string | null>(null);
  protected activeTab$ = new BehaviorSubject<'live' | 'upcoming' | 'played'>('upcoming');
  protected $matchDates!: Observable<string[]>;

  $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  $playedMatches!: Observable<Matches[]>;
  totalPoints$!: Observable<{ value: number } | null>;

  get activeMatches(): boolean {
    return this.activeTab === 'upcoming' || this.activeTab === 'live';
  }

  ngOnInit(): void {
    this.$today = this.globalTime.getMuTime();

    // Helper function to only allow "published" matches
    const isDraft = (match: Matches) => {
      return match.status === 'draft';
    };

    this.$matchDates = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.activeTab$
    ]).pipe(
      map(([matches, today, tab]) => {
        const now = new Date(today.dateTime.slice(0, -6));
        const filtered = matches.filter(match => {

          // --- FILTER BY STATUS ---
          if (isDraft(match)) return false;

          const isFinished = match.status === 'FINISHED' || match.status === 'finished' || match.played === true;
          const matchDate = new Date(match.date);
          const hasStarted = now >= matchDate;

          if (tab === 'live') {
            return hasStarted && !isFinished;
          } else if (tab === 'upcoming') {
            return !hasStarted && !isFinished;
          } else {
            return isFinished;
          }
        });

        const dates = filtered.map(m => m.date.split(' ')[0]);
        // Sort ascending (earliest first) for upcoming/live, descending (newest first) for played
        return Array.from(new Set(dates)).sort((a, b) => {
          const timeA = new Date(a).getTime();
          const timeB = new Date(b).getTime();
          return tab === 'played' ? timeB - timeA : timeA - timeB;
        });
      })
    );

    this.$groupedMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.filterDate$
    ]).pipe(
      tap(([matches, today]) => {
        Promise.resolve().then(() => {
          const now = new Date(today.dateTime.slice(0, -6));
          this.liveCount = matches.filter(m => {
            const isFinished = m.status === 'FINISHED' || m.status === 'finished' || m.played === true;
            const matchDate = new Date(m.date);
            const hasStarted = now >= matchDate;
            return hasStarted && !isFinished;
          }).length;
          this.upcomingCount = matches.filter(m => {
            const isFinished = m.status === 'FINISHED' || m.status === 'finished' || m.played === true;
            const matchDate = new Date(m.date);
            const hasStarted = now >= matchDate;
            return !hasStarted && !isFinished;
          }).length;
          this.playedCount = matches.filter(m => m.status === 'FINISHED' || m.status === 'finished' || m.played === true).length;

          const todayKey = today.dateTime.split('T')[0];
          const todayMatches = matches.filter(m => m.date.split(' ')[0] === todayKey);
          this.todayTotalCount = todayMatches.length;
          this.todayPlayedCount = todayMatches.filter(m => m.status === 'FINISHED' || m.status === 'finished' || m.played === true).length;
          this.todayMatchCount = todayMatches.filter(m => m.status !== 'FINISHED' && m.status !== 'finished' && m.played !== true).length;

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
          this.cdr.detectChanges();
        });
      }),
      map(([matches, today, filterDate]) => {
        this.filterDate = filterDate;
        const now = new Date(today.dateTime.slice(0, -6));

        // --- FILTER MATCHES HERE ---
        let filtered = matches.filter(match => {

          // 1. Restrict to published only
          if (isDraft(match)) return false;

          // 2. Filter by Active Tab
          const isFinished = match.status === 'FINISHED' || match.status === 'finished' || match.played === true;
          const matchDate = new Date(match.date);
          const hasStarted = now >= matchDate;

          if (this.activeTab === 'live') {
            return hasStarted && !isFinished;
          } else if (this.activeTab === 'upcoming') {
            return !hasStarted && !isFinished;
          } else {
            return isFinished;
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

    // ── Fetch total points from the new pronostics_rankings collection ───────
    this.totalPoints$ = this.stateService.userState.pipe(
      switchMap(user => {
        if (!user?.id || !user?.last_name) return of(null);
        return this.rankingsService.getUserRanking(user.last_name).pipe(
          map(res => {
            const list = res?.data || res || [];
            if (list.length > 0) {
              return { value: Number(list[0].point) || 0 };
            }
            return { value: 0 };
          }),
          catchError(() => of({ value: 0 }))
        );
      })
    );

    this.predictionService.drafts$.subscribe(drafts => {
      this.draftsCount = drafts.length;
      this.cdr.detectChanges();
    });
  }

  setActiveTab(tab: 'live' | 'upcoming' | 'played'): void {
    this.activeTab = tab;
    this.filterDate$.next(null);
    this.activeTab$.next(tab);
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
    return matches.some(m => m.status !== 'FINISHED' && m.status !== 'finished' && m.played !== true);
  }

  hasPlayed(matches: Matches[]): boolean {
    return matches.some(m => m.status === 'FINISHED' || m.status === 'finished' || m.played === true);
  }

  unpredictedCount(matches: Matches[]): number {
    return matches.filter(m => m.status !== 'FINISHED' && m.status !== 'finished' && m.played !== true).length;
  }

  getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  isLive(match: Matches, currentMuTimeStr: string): boolean {
    const now = new Date(currentMuTimeStr.slice(0, -6));
    const matchDate = new Date(match.date);
    const isFinished = match.status === 'FINISHED' || match.status === 'finished' || match.played === true;
    const timeDiffMs = now.getTime() - matchDate.getTime();
    const timeDiffMins = timeDiffMs / (1000 * 60);
    return timeDiffMins >= 0 && timeDiffMins < 150 && !isFinished;
  }

  getSortedPlayedMatchesForDate(matches: Matches[]): Matches[] {
    return (matches || [])
      .filter(m => m.status === 'FINISHED' || m.status === 'finished' || m.played === true)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getPlayedDates(groupedMatches: { [key: string]: Matches[] }): string[] {
    return Object.keys(groupedMatches)
      .filter(date => this.hasPlayed(groupedMatches[date]))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  getPlayedCountForDate(matches: Matches[]): number {
    return matches.filter(m => m.status === 'FINISHED' || m.status === 'finished' || m.played === true).length;
  }

  compareDates(date1: string, date2: string): boolean {
    return date1.slice(0, 10) > date2;
  }

  getUpcomingPhases(groupedMatches: { [key: string]: Matches[] }): typeof PHASE_CONFIG {
    const allUpcoming = Object.values(groupedMatches).flat()
      .filter(m => m.status !== 'FINISHED' && m.status !== 'finished' && m.played !== true);
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
        .filter(m => m.phase === phaseKey && m.status !== 'FINISHED' && m.status !== 'finished' && m.played !== true);
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
    let invalidMatches: string[] = [];

    this.matchesService.getAllMatches().pipe(
      map(allMatches => {
        return drafts.map(draft => {
          const correspondingMatch = allMatches.find(m => m.id === draft.game_id);
          const kickoffTime = correspondingMatch ? correspondingMatch.date : new Date().toISOString();

          return this.predictionService.sendPrediction(draft, kickoffTime).pipe(
            catchError(err => {
              if (err.message === 'MATCH_ALREADY_STARTED' && correspondingMatch) {
                // Collect team names contextually (Adjust property keys depending on contract)
                const teamA = correspondingMatch.team_a || 'Équipe A';
                const teamB = correspondingMatch.team_b || 'Équipe B';
                invalidMatches.push(`${teamA} - ${teamB}`);
              }
              console.error('Failed to send prediction for game:', draft.game_id, err);
              return of(null);
            })
          );
        });
      }),
      switchMap(requests => forkJoin(requests))
    ).subscribe({
      next: () => {
        this.isSubmittingBulk = false;

        if (invalidMatches.length > 0) {
          // Set context and trigger your beautiful design popup modal
          this.lockedMatchName = invalidMatches.join(', ');
          this.showLockPopup = true;
          this.cdr.detectChanges();

          // Automatically clear drafts that failed and don't reload page immediately 
          // to give the user time to read the dynamic error toast.
          this.predictionService.clearDrafts();
        } else {
          // Clear drafts and reload clean if everything was perfectly successful
          this.predictionService.clearDrafts();
          location.reload();
        }
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
}