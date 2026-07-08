import { Injectable, inject } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';
import { Observable, forkJoin, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatchesApiService } from '../api/matches-api.service';

@Injectable({
  providedIn: 'root'
})
export class MatchesService {
  private matchesApiService = inject(MatchesApiService);

  getAllMatches(): Observable<Matches[]> {
    return this.matchesApiService.getMatches().pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getMatchesByGroup(groupName: string): Observable<Matches[]> {
    return this.matchesApiService.getMatches(`?filter[group]=${groupName}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getMatchesByPhase(phase: string): Observable<Matches[]> {
    return this.matchesApiService.getMatches(`?filter[phase]=${phase}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }

  getMatchesByTeam(team: string): Observable<Matches[]> {
    const teamA$ = this.matchesApiService.getMatches(`?filter[team_a]=${team}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );

    const teamB$ = this.matchesApiService.getMatches(`?filter[team_b]=${team}`).pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );

    return forkJoin([teamA$, teamB$]).pipe(
      map(([teamAMatches, teamBMatches]) => [...(teamAMatches || []), ...(teamBMatches || [])]),
      catchError(() => of([]))
    );
  }

  getPlayedMatches(): Observable<Matches[]>{
    return this.matchesApiService.getMatches('?filter[fulltime_b][nnull]').pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }
}
