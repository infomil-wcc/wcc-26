import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class PronosticsRankingsApiService {
  private http = inject(HttpClient);

  getRankings(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/pronostics_rankings${queryParams}`, options);
  }

  createRanking(data: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/pronostics_rankings`, data, options);
  }

  updateRanking(id: any, data: any, options?: any): Observable<any> {
    return this.http.patch<any>(`${environment.apiBaseUrl}/items/pronostics_rankings/${id}`, data, options);
  }

  deleteRanking(id: any, options?: any): Observable<any> {
    return this.http.delete<any>(`${environment.apiBaseUrl}/items/pronostics_rankings/${id}`, options);
  }
}
