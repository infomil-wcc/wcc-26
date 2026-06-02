import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Teams, Players, playersApiData, teamsApiData, Group, GroupApiData } from '../../contracts/teams.contract';
import { Observable, map } from 'rxjs';

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
    return this.http.get<teamsApiData>(`https://euro.omediainteractive.net/imleuro/items/teams`).pipe(
      map(response => response.data)
    );
  }

  getTeamByGroup(groupId: string): Observable<Teams[]> {
    return this.http.get<teamsApiData>(`https://euro.omediainteractive.net/imleuro/items/teams?filter[group]=${groupId}`).pipe(
      map(response => response.data)
    );
  }

  getPlayersByTeamName(teamName: string): Observable<Players[]> {
    return this.http.get<playersApiData>(`https://euro.omediainteractive.net/imleuro/items/players?filter[team]=${teamName}`).pipe(
      map(response => response.data)
    );
  }

  getTeamByName(teamName: string): Observable<Teams[]> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/teams?filter[name]=${teamName}`).pipe(
      map(response => response.data)
    );
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<GroupApiData>(`https://euro.omediainteractive.net/imleuro/items/group`).pipe(
      map(response => response.data)
    )
  }

  getFlags(): Observable<any> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/teams?fields=flag_url,name`).pipe(
      map(response => response.data)
    );
  }

  getTeamsInfo(teamisoname: string): any {
    // if using proxy
    return this.http.get<any[]>(`/api/teams?iso=${teamisoname}`, this.httpOptions);
    // if using direct API call
    // return this.http.get<any[]>(`https://wcc-26-app.vercel.app/api/teams?iso=${teamisoname}`, this.httpOptions);
  }
}
