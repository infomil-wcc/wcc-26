import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NewsService } from '../../shared/services/content/news.service';
import { Observable, combineLatest, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { MatchesService } from '../../shared/services/content/matches.service';
import { TeamsService } from '../../shared/services/content/teams.service';
import { RankingsService } from '../../shared/services/content/rankings.service';
import { GlobaltimeService } from '../../shared/services/core/globaltime.service';
import { Matches } from '../../shared/contracts/matches.contract';
import { MatchComponent } from '../../shared/components/match/match.component';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { AsyncPipe, DatePipe, NgClass, UpperCasePipe } from '@angular/common';

@Component({
    selector: 'app-hpnews',
    templateUrl: './hpnews.component.html',
    styleUrl: './hpnews.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatchComponent, LoaderComponent, AsyncPipe, DatePipe, NgClass, UpperCasePipe]
})
export class HpnewsComponent {
  private newsService = inject(NewsService);
  protected $newsData!: Observable<any[]>;
  protected $registeredUsers!: Observable<any>;
  protected currentPage: number = 0;
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);
  private teamsService = inject(TeamsService);
  private rankingsService = inject(RankingsService);

  protected topPlayers: any[] = [];

  $filteredMatches!: Observable<any[]>;
  $currentSlideIndex!: Observable<number>;
  protected $today!: Observable<any>;

  ngOnInit():void {
    this.$newsData = this.newsService.getHPnews();
    this.$registeredUsers = this.newsService.getRegisteredUsers();
    this.initialiseMatchSlider();
  }

  newsChunks(news: any[], size: number) {
    let chunks = [];
    for (let i = 0; i < news.length; i += size) {
      chunks.push(news.slice(i, i + size));
    }
    return chunks;
  }

  nextPage() {
    this.currentPage++;
  }

  previousPage() {
    this.currentPage--;
  }

  handleNewsOpen(item: any) {
    if(item.route){
      location.href = item.route;
    } else {
      console.log('handle news content');
    }
  }

  initialiseMatchSlider() {
    this.$today = this.globalTime.getMuTime();

    // Fetch the top 3 players for the podium
    this.rankingsService.getPronosticsRankings().subscribe(rankings => {
      if (rankings && rankings.length > 0) {
        rankings.sort((a: any, b: any) => (a.rank || 1) - (b.rank || 1));
        this.topPlayers = rankings.slice(0, 3);
        while(this.topPlayers.length < 3) {
          this.topPlayers.push({ trigramme: '---', point: 0 });
        }
      }
    });
  
    // Get matches for current day + 2 days and flags for the winner slide
    this.$filteredMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today,
      this.teamsService.getFlags()
    ]).pipe(
      map(([matches, today, flags]) => {
        const baseDate = new Date(today.dateTime);
        const allowedDates = Array.from({ length: 3 }, (_, i) => {
          const targetDate = new Date(baseDate);
          targetDate.setDate(baseDate.getDate() + i);
          
          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const day = String(targetDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        });

        if (!matches || !Array.isArray(matches)) {
          return [];
        }
        
        let filtered: any[] = matches
          .filter(match => {
            const matchDateStr = match.date.split(' ')[0];
            return allowedDates.includes(matchDateStr);
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Find the final match and if it is finished, push it to the carousel
        const finalMatch = matches.find(m => m.phase === 'Final' && m.fulltime_a !== null);
        if (finalMatch) {
            let winningTeam = null;
            if (finalMatch.winner_draw === finalMatch.team_a) winningTeam = finalMatch.team_a;
            else if (finalMatch.winner_draw === finalMatch.team_b) winningTeam = finalMatch.team_b;
            else if (finalMatch.fulltime_a !== null && finalMatch.fulltime_b !== null) {
                if (finalMatch.fulltime_a > finalMatch.fulltime_b) winningTeam = finalMatch.team_a;
                else if (finalMatch.fulltime_b > finalMatch.fulltime_a) winningTeam = finalMatch.team_b;
            }

            if (winningTeam) {
                const teamObj = flags?.find((f: any) => f.name === winningTeam);
                const winningTeamFlag = teamObj ? teamObj.flag_url : '';
                const winnerSlide = { ...finalMatch, isWorldCupWinner: true, winningTeam: winningTeam, winningTeamFlag: winningTeamFlag };
                filtered.unshift(winnerSlide);
            }
        }

        return filtered;
      })
    );
    
    // Auto-slide tracker (Changes every 5000ms)
    this.$currentSlideIndex = this.$filteredMatches.pipe(
      switchMap(matches => 
        timer(0, 5000).pipe(
          map(tick => matches.length ? tick % matches.length : 0)
        )
      )
    );
  }

  isUpcomingMatch(match: Matches, allMatches: Matches[], currentDateTime: string): boolean {
    const now = new Date(currentDateTime).getTime();
    const upcomingMatch = allMatches.find(m => new Date(m.date).getTime() > now);
    return upcomingMatch ? match === upcomingMatch : false;
  }

  isFuturMatch(match: Matches, currentDateTime: string): boolean {
    const now = new Date(currentDateTime).getTime();
    return now > new Date(match.date).getTime() ? false : true;
  }
}
