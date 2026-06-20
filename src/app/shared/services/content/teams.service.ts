import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Teams, TeamResponse, playersApiData, teamsApiData, Group, GroupApiData, Player } from '../../contracts/teams.contract';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamsService {

  constructor(private http: HttpClient) { }

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  getAllTeams(): Observable<Teams[]> {
    return this.http.get<teamsApiData>(`${environment.apiBaseUrl}/items/teams`).pipe(
      map(response => response.data)
    );
  }

  getTeamByGroup(groupId: string): Observable<Teams[]> {
    return this.http.get<teamsApiData>(`${environment.apiBaseUrl}/items/teams?filter[group]=${groupId}`).pipe(
      map(response => response.data)
    );
  }

  getPlayersByTeamName(teamName: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/squads?country=${teamName}`);
  }

  getTeamByName(teamName: string): Observable<Teams[]> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/teams?filter[name]=${teamName}`).pipe(
      map(response => response.data)
    );
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<GroupApiData>(`${environment.apiBaseUrl}/items/group`).pipe(
      map(response => response.data)
    )
  }

  getFlags(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/teams?fields=flag_url,name,iso`).pipe(
      map(response => response.data)
    );
  }

  getTeamsInfo(teamisoname: string): any {
    // if using proxy
    return this.http.get<any[]>(`${environment.apiUrl}/teams?iso=${teamisoname}`, this.httpOptions);
    // if using direct API call
    // return this.http.get<any[]>(`https://wcc-26-app.vercel.app/api/teams?iso=${teamisoname}`, this.httpOptions);
  }
}
