import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PronostiquesRankingsApiService {
  private http = inject(HttpClient);

  getRankings(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/pronostiques_rankings${queryParams}`, options);
  }

  createRankings(data: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/pronostiques_rankings`, data, options);
  }

  updateRankings(id: number, data: any, options?: any): Observable<any> {
    return this.http.patch<any>(`${environment.apiBaseUrl}/items/pronostiques_rankings/${id}`, data, options);
  }

  deleteRankings(id: number, options?: any): Observable<any> {
    return this.http.delete<any>(`${environment.apiBaseUrl}/items/pronostiques_rankings/${id}`, options);
  }
}
