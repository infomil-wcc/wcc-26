import { inject, Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class TotalgoalsService {
  private httpClient = inject(HttpClient);


  hasTotalGoals(user: string): Observable<any> {
    return this.httpClient.get<any>(`https://euro.omediainteractive.net/imleuro/items/total_goals?filter[trigramme]=${user}`).pipe(
      map(response => response.data)
    );
  }

  submitGoals(user: string, goals: number, token: string): Observable<any> {
    const payload = {
      status: 'published',
      trigramme: user,
      goals: goals
    };

    const httpOptions = {
      headers: new HttpHeaders({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
      })
    }

    return this.httpClient.post<any>('https://euro.omediainteractive.net/imleuro/items/total_goals', payload,httpOptions);
  }
}
