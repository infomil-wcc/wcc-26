import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class BracketRankingsApiService {
  private http = inject(HttpClient);

  getRankings(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/bracket_rankings${queryParams}`, options);
  }

  createRankings(data: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/bracket_rankings`, data, options);
  }

  updateRankings(id: any, data: any, options?: any): Observable<any> {
    return this.http.patch<any>(`${environment.apiBaseUrl}/items/bracket_rankings/${id}`, data, options);
  }
}
