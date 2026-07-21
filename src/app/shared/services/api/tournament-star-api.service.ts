import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TournamentStarApiService {
  private http = inject(HttpClient);

  getTournamentStars(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/tournament_stars${queryParams}`, options);
  }
}
