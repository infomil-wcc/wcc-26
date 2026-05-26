import { Component, inject } from '@angular/core';
import { NewsService } from '../../shared/services/content/news.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-hpnews',
  templateUrl: './hpnews.component.html',
  styleUrl: './hpnews.component.scss'
})
export class HpnewsComponent {

  private newsService = inject(NewsService);
  protected $newsData!: Observable<any[]>;
  protected currentPage: number = 0;

  ngOnInit():void {
    this.$newsData = this.newsService.getHPnews();
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
}
