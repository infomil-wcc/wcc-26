import { Component, inject } from '@angular/core';
import { NewsService } from '../../shared/services/content/news.service';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
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
  // private matchesService = inject(MatchesService);
  // private globalTime = inject(GlobaltimeService);

  // $groupedMatches!: Observable<{ [key: string]: Matches[] }>;
  // protected $today!: Observable<any>;

  ngOnInit():void {
    this.$newsData = this.newsService.getHPnews();
    this.$registeredUsers = this.newsService.getRegisteredUsers();

    // this.$today = this.globalTime.getMuTime();
    
    // // Combine both streams to ensure we have the current reference date for filtering
    // this.$groupedMatches = combineLatest([
    //   this.matchesService.getAllMatches(),
    //   this.$today
    // ]).pipe(
    //   map(([matches, todayDateString]) => this.groupMatchesByThreeDayWindow(matches, todayDateString))
    // );
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

  // groupMatchesByThreeDayWindow(matches: Matches[], todayStr: string): { [key: string]: Matches[] } {
  //   const today = new Date(todayStr);
  //   today.setHours(0, 0, 0, 0);

  //   const maxDate = new Date(today);
  //   maxDate.setDate(today.getDate() + 2);
  //   maxDate.setHours(23, 59, 59, 999);

  //   const groupKey = 'Today & Next 2 Days';
  //   const filteredMatches = matches.filter(match => {
  //     const matchDate = new Date(match.date);
  //     return matchDate >= today && matchDate <= maxDate;
  //   });

  //   // Sort chronologically
  //   filteredMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  //   return { [groupKey]: filteredMatches };
  // }

  // getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
  //   return Object.keys(groupedMatches);
  // }
}
