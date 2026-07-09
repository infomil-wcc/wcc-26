import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NewsService } from '../../../core/services/content/news.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatchesService } from '../../../core/services/content/matches.service';
import { GlobaltimeService } from '../../../core/services/core/global-time.service';
import { Matches } from '../../../shared/contracts/matches.contract';
import { MatchComponent } from '../match/match.component';
import { LoaderComponent } from '../loader/loader.component';
import { AsyncPipe, DatePipe, NgClass } from '@angular/common';

@Component({
    selector: 'news',
    templateUrl: './news.component.html',
    styleUrl: './news.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatchComponent, LoaderComponent, AsyncPipe, DatePipe, NgClass]
})
export class HpNewsComponent {
  private newsService = inject(NewsService);
  protected $upcomingMatches!: Observable<Matches[]>;
  protected $topNews!: Observable<any[]>;
  protected $today!: Observable<any>;
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);

  protected matchIndex: number = 0;

  ngOnInit(): void {
    this.$today = this.globalTime.getMuTime();

    // Get top 3 news items
    this.$topNews = this.newsService.getHPnews().pipe(
      map(news => news ? news.slice(0, 3) : [])
    );

    // Get the next 10 upcoming matches starting from the nearest one
    this.$upcomingMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today
    ]).pipe(
      map(([matches, today]) => {
        if (!matches || !Array.isArray(matches)) return [];
        const now = new Date(today.dateTime).getTime();
        const sorted = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const nextIndex = sorted.findIndex(m => new Date(m.date).getTime() > now);
        // Start from the upcoming match (or last if all played), take 10
        const start = nextIndex >= 0 ? nextIndex : Math.max(0, sorted.length - 10);
        return sorted.slice(start, start + 10);
      })
    );
  }

  protected prevMatch(): void {
    if (this.matchIndex > 0) this.matchIndex--;
  }

  protected nextMatch(total: number): void {
    if (this.matchIndex < total - 1) this.matchIndex++;
  }

  handleNewsOpen(item: any) {
    if (item.route) {
      location.href = item.route;
    } else {
      console.log('handle news content');
    }
  }

  protected isToday(matchDateStr: string, todayStr: string): boolean {
    const matchDate = new Date(matchDateStr);
    const today = new Date(todayStr);
    return matchDate.getFullYear() === today.getFullYear() &&
           matchDate.getMonth() === today.getMonth() &&
           matchDate.getDate() === today.getDate();
  }
}
