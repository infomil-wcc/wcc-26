import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NewsApiService {
  private http = inject(HttpClient);

  getNews(queryParams: string = ''): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/news${queryParams}`);
  }
}
