import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, mergeMap, of } from 'rxjs';
import { NewsApiService } from '../api/news-api.service';
import { FilesApiService } from '../api/files-api.service';
import { UsersApiService } from '../api/users-api.service';

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private newsApiService = inject(NewsApiService);
  private filesApiService = inject(FilesApiService);
  private usersApiService = inject(UsersApiService);

  getHPnews(): Observable<any[]> {
    return this.newsApiService.getNews('?fields=title,image,route,content,id')
      .pipe(
        mergeMap(newsData => {
          const newsItems = newsData && newsData.data ? newsData.data : [];

          const requests = newsItems.map((newsItem: { image: any; }) => {
            const imageId = newsItem.image;
            return this.filesApiService.getFile(imageId);
          });

          return forkJoin(requests).pipe(
            map((imageInfos: any)=> {
              return newsItems.map((newsItem: any, index: string | number) => {
                return {
                  ...newsItem,
                  imgUrl: imageInfos[index].data.data.full_url,
                  imgThumnails: imageInfos[index].data.data.thumbnails
                };
              });
            })
          );
        }),
        catchError(error => {
          console.error('Error fetching news:', error);
          return of([]);
        })
      );
  }

  getNewsDetails(newsId: string): Observable<any[]> {
    return this.newsApiService.getNews(`?filter[id]=${newsId}`)
      .pipe(
        mergeMap(newsData => {
          const newsItems = newsData && newsData.data ? newsData.data : [];

          const requests = newsItems.map((newsItem: { image: any; }) => {
            const imageId = newsItem.image;
            return this.filesApiService.getFile(imageId);
          });

          return forkJoin(requests).pipe(
            map((imageInfos: any)=> {
              return newsItems.map((newsItem: any, index: string | number) => {
                return {
                  ...newsItem,
                  imgUrl: imageInfos[index].data.data.full_url,
                  imgThumnails: imageInfos[index].data.data.thumbnails
                };
              });
            })
          );
        }),
        catchError(error => {
          console.error('Error fetching news:', error);
          return of([]);
        })
      );
  }

  getRegisteredUsers(): Observable<any> {
    return this.usersApiService.getUsersFromApiUrl()
      .pipe(
        catchError(error => {
          console.error('Error fetching registered users:', error);
          return of(0);
        })
      );
  }
}
