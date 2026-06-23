import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LineupsApiService {
  private http = inject(HttpClient);

  getLineups(teamA: string, teamB: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/lineups?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}`);
  }
}
