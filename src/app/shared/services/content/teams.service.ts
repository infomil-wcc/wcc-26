import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Teams, Group } from '../../contracts/teams.contract';
import { Observable, map } from 'rxjs';
import { TeamsApiService } from '../api/teams-api.service';
import { GroupsApiService } from '../api/groups-api.service';

@Injectable({
  providedIn: 'root'
})
export class TeamsService {
  private teamsApiService = inject(TeamsApiService);
  private groupsApiService = inject(GroupsApiService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  getAllTeams(): Observable<Teams[]> {
    return this.teamsApiService.getTeams().pipe(
      map(response => response.data)
    );
  }

  getTeamByGroup(groupId: string): Observable<Teams[]> {
    return this.teamsApiService.getTeams(`?filter[group]=${groupId}`).pipe(
      map(response => response.data)
    );
  }

  getPlayersByTeamName(teamName: string): Observable<any> {
    return this.teamsApiService.getPlayersByCountry(teamName).pipe(
      map(response => response[0])
    );
  }

  getTeamByName(teamName: string): Observable<Teams[]> {
    return this.teamsApiService.getTeams(`?filter[name]=${teamName}`).pipe(
      map(response => response.data)
    );
  }

  getGroups(): Observable<Group[]> {
    return this.groupsApiService.getGroups().pipe(
      map(response => response.data)
    );
  }

  getFlags(): Observable<any> {
    return this.teamsApiService.getTeams('?fields=flag_url,name,iso').pipe(
      map(response => response.data)
    );
  }

  getTeamsInfo(teamisoname: string): any {
    return this.teamsApiService.getTeamsInfo(teamisoname, this.httpOptions);
  }
}
