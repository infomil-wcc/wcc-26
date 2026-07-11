import { Service, inject, Signal, computed, Injector } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';
import { httpResource } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Service()
export class MatchesService {
  // Global resources
  private _allMatchesRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/matches`);
  readonly allMatches = computed(() => this._allMatchesRes.value()?.data || []);

  private _playedMatchesRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/matches?filter[fulltime_a][nnull]=true`);
  readonly playedMatches = computed(() => this._playedMatchesRes.value()?.data || []);
  getMatchesByGroup(groupName: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof groupName === 'string' ? () => `${environment.apiBaseUrl}/items/matches?filter[group]=${groupName}` : () => `${environment.apiBaseUrl}/items/matches?filter[group]=${groupName()}`;
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value()?.data || []);
  }

  getMatchesByPhase(phase: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof phase === 'string' ? () => `${environment.apiBaseUrl}/items/matches?filter[phase]=${phase}` : () => `${environment.apiBaseUrl}/items/matches?filter[phase]=${phase()}`;
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value()?.data || []);
  }

  getMatchesByTeam(team: string | Signal<string>, options?: { injector?: Injector }) {
    // For multiple requests, we can just fetch all matches or rely on two resources.
    // Given httpResource limitations for forkJoin, we can do this reactively by creating a combined signal.
    const teamName = typeof team === 'string' ? () => team : team;
    
    const reqA = computed(() => {
      const val = teamName();
      return val ? `${environment.apiBaseUrl}/items/matches?filter[team_a]=${val}` : undefined;
    });
    const reqB = computed(() => {
      const val = teamName();
      return val ? `${environment.apiBaseUrl}/items/matches?filter[team_b]=${val}` : undefined;
    });
    
    const resA = httpResource<any>(reqA, { injector: options?.injector });
    const resB = httpResource<any>(reqB, { injector: options?.injector });
    
    return computed(() => [...(resA.value()?.data || []), ...(resB.value()?.data || [])]);
  }
}
