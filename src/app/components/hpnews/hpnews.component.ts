import { Component, inject } from '@angular/core';
import { NewsService } from '../../shared/services/content/news.service';
import { Observable, combineLatest, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { MatchesService } from '../../shared/services/content/matches.service';
import { GlobaltimeService } from '../../shared/services/core/globaltime.service';
import { Matches } from '../../shared/contracts/matches.contract';

@Component({
  selector: 'app-hpnews',
  templateUrl: './hpnews.component.html',
  styleUrl: './hpnews.component.scss'
})
export class HpnewsComponent {
  private newsService = inject(NewsService);
  protected $newsData!: Observable<any[]>;
  protected $registeredUsers!: Observable<any>;
  protected currentPage: number = 0;
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);

  $filteredMatches!: Observable<Matches[]>;
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
  
    // Get matches for current day + 2 days
    this.$filteredMatches = combineLatest([
      this.matchesService.getAllMatches(),
      this.$today
    ]).pipe(
      map(([matches, today]) => {
        const baseDate = new Date(today.dateTime);
        const allowedDates = Array.from({ length: 3 }, (_, i) => {
          const targetDate = new Date(baseDate);
          targetDate.setDate(baseDate.getDate() + i);
          
          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const day = String(targetDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        });

        return matches
          .filter(match => {
            const matchDateStr = match.date.split(' ')[0];
            return allowedDates.includes(matchDateStr);
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
}
