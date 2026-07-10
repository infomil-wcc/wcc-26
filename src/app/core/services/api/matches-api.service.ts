import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Service()
export class MatchesApiService {
  private http = inject(HttpClient);

  getMatches(queryParams: string = ''): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/matches${queryParams}`);
  }
}
