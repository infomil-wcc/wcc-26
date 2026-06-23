import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MatchResultsApiService {
  private http = inject(HttpClient);

  postMatchResults(options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/match-results`, {}, options);
  }
}
