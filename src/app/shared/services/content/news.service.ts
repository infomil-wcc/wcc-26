import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, mergeMap, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NewsService {

  private http = inject(HttpClient);

  getHPnews(): Observable<any[]> {
    return this.http.get<any>('https://euro.omediainteractive.net/imleuro/items/news?fields=title,image,route,content,id')
      .pipe(
        mergeMap(newsData => {
          const newsItems = newsData && newsData.data ? newsData.data : [];

          const requests = newsItems.map((newsItem: { image: any; }) => {
            const imageId = newsItem.image;
            // Make request to get image info from file api
            return this.http.get(`https://euro.omediainteractive.net/imleuro/files/${imageId}`);
          });

          // Combine requests in observable
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
          return of([]); // Return empty array to prevent further error
        })
      );
  }

  getNewsDetails(newsId: string): Observable<any[]> {
    return this.http.get<any>('https://euro.omediainteractive.net/imleuro/items/news?filter[id]=${newsId}')
      .pipe(
        mergeMap(newsData => {
          const newsItems = newsData && newsData.data ? newsData.data : [];

          const requests = newsItems.map((newsItem: { image: any; }) => {
            const imageId = newsItem.image;
            // Make request to get image info from file api
            return this.http.get(`https://euro.omediainteractive.net/imleuro/files/${imageId}`);
          });

          // Combine requests in observable
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
          return of([]); // Return empty array to prevent further error
        })
      );
  }


}
