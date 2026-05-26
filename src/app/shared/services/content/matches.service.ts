import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Matches, matchesApiData } from '../../contracts/matches.contract';
import { Observable, forkJoin, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MatchesService {

  constructor(private http: HttpClient) { }

  getAllMatches(): Observable<Matches[]> {
    return this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches`).pipe(
      map(response => response.data)
    );
  }

  getMatchesByGroup(groupName: string): Observable<Matches[]> {
    return this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches?filter[group]=${groupName}`).pipe(
      map(response => response.data)
    );
  }

  getMatchesByPhase(phase: string): Observable<Matches[]> {
    return this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches?filter[phase]=${phase}`).pipe(
      map(response => response.data)
    );
  }

  getMatchesByTeam(team: string): Observable<Matches[]> {

    const teamA$ = this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches?filter[team_a]=${team}`).pipe(
      map(response => response.data)
    );

    const teamB$ = this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches?filter[team_b]=${team}`).pipe(
      map(response => response.data)
    );

    return forkJoin([teamA$, teamB$]).pipe(
      map(([teamAMatches, teamBMatches]) => [...teamAMatches, ...teamBMatches])
    );
  }

  getPlayedMatches(): Observable<Matches[]>{
    return this.http.get<matchesApiData>(`https://euro.omediainteractive.net/imleuro/items/matches?filter[fulltime_b][nnull]`).pipe(
      map(response => response.data)
    );
  }
}

