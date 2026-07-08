import { Injectable, inject } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PronosticsRankingsApiService } from '../api/pronostics-rankings-api.service';
import { BracketRankingsApiService } from '../api/bracket-rankings-api.service';
import { AuthService } from '../core/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RankingsService {
  private pronosticsRankingsApiService = inject(PronosticsRankingsApiService);
  private bracketRankingsApiService = inject(BracketRankingsApiService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private rankingBot = {
    'email': 'ranking.bot@infomil.mu',
    'password': 'infomil'
  };

  getPronosticsRankings(): Observable<any> {
    return this.authService.trylogin(this.rankingBot.email, this.rankingBot.password).pipe(
      switchMap(loginRes => {
        const data = loginRes?.data || loginRes;
        const token = data?.token || data?.access_token || '';
        const httpOptions = {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
        };
        return this.pronosticsRankingsApiService.getRankings('', httpOptions);
      }),
      map(response => response?.data || [])
    );
  }

  getBracketRankings(): Observable<any> {
    return this.authService.trylogin(this.rankingBot.email, this.rankingBot.password).pipe(
      switchMap(loginRes => {
        const data = loginRes?.data || loginRes;
        const token = data?.token || data?.access_token || '';
        const httpOptions = {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
        };
        return this.bracketRankingsApiService.getRankings('', httpOptions);
      }),
      map(response => response?.data || [])
    );
  }

  getUserRanking(username: string): Observable<any> {
    return this.authService.trylogin(this.rankingBot.email, this.rankingBot.password).pipe(
      switchMap(loginRes => {
        const data = loginRes?.data || loginRes;
        const token = data?.token || data?.access_token || '';
        const httpOptions = {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
        };
        return this.pronosticsRankingsApiService.getRankings(`?filter[key]=${username}`, httpOptions);
      }),
      map(response => response?.data || [])
    );
  }

  recalculateRankings(): Observable<any> {
    return this.http.get('/api/match-results?points=all');
  }
}
