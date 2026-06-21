import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamsApiService {
  private http = inject(HttpClient);

  getTeams(queryParams: string = ''): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/teams${queryParams}`);
  }

  getPlayersByCountry(country: string): Observable<any> {
    return this.http.get<any>(`/api/squads?country=${country}`);
  }

  getTeamsInfo(teamisoname: string, options: any): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/teams?iso=${teamisoname}`, options);
  }
}
