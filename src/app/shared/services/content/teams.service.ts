import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Teams, Group } from '../../contracts/teams.contract';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TeamsApiService } from '../api/teams-api.service';
import { GroupsApiService } from '../api/groups-api.service';
import { SquadsApiService } from '../api/squads-api.service';

@Injectable({
  providedIn: 'root'
})
export class TeamsService {
  private teamsApiService = inject(TeamsApiService);
  private groupsApiService = inject(GroupsApiService);
  private squadsApiService = inject(SquadsApiService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  getAllTeams(): Observable<Teams[]> {
    return this.teamsApiService.getTeams().pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getTeamByGroup(groupId: string): Observable<Teams[]> {
    return this.teamsApiService.getTeams(`?filter[group]=${groupId}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getPlayersByTeamName(teamName: string): Observable<any> {
    return this.squadsApiService.getPlayersByCountry(teamName).pipe(
      map(response => response?.[0] || null),
      catchError(() => of(null))
    );
  }

  getTeamByName(teamName: string): Observable<Teams[]> {
    return this.teamsApiService.getTeams(`?filter[name]=${teamName}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getTeamColors(teamName: string): Observable<string[]> {
    return this.teamsApiService.getTeamsJSON(`?name=${teamName}&select=colors`);
  }

  getGroups(): Observable<Group[]> {
    return this.groupsApiService.getGroups().pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getFlags(): Observable<any> {
    return this.teamsApiService.getTeams('?fields=flag_url,name,iso').pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getTeamsInfo(teamisoname: string): any {
    return this.teamsApiService.getTeamsInfo(teamisoname, this.httpOptions);
  }
}
