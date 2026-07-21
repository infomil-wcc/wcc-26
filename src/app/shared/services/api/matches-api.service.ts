import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MatchesApiService {
  private http = inject(HttpClient);

  getMatches(queryParams: string = ''): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/matches${queryParams}`);
  }

  updateMatch(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${environment.apiBaseUrl}/admin/match/${id}`, payload);
  }
}
