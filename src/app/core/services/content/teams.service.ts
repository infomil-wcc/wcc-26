import { Service, inject, Signal, computed, Injector } from '@angular/core';
import { HttpHeaders, httpResource } from '@angular/common/http';
import { Teams, Group } from '../../../shared/contracts/teams.contract';
import { SquadsApiService } from '../api/squads-api.service';
import { environment } from '../../../../environments/environment';

@Service()
export class TeamsService {
  private squadsApiService = inject(SquadsApiService);


  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  // Global resources cached at the service level
  private _allTeamsRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/teams`);
  readonly allTeams = computed(() => this._allTeamsRes.value()?.data || []);

  private _groupsRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/group`);
  readonly groups = computed(() => this._groupsRes.value()?.data || []);

  private _flagsRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/teams?fields=flag_url,name,iso`);
  readonly flags = computed(() => this._flagsRes.value()?.data || []);

  // Methods returning component-scoped resources (must be called in component injection context)
  getTeamByGroup(groupId: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof groupId === 'string' ? () => `${environment.apiBaseUrl}/items/teams?filter[group]=${groupId}` : () => `${environment.apiBaseUrl}/items/teams?filter[group]=${groupId()}`;
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value()?.data || []);
  }

  getPlayersByTeamName(teamName: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof teamName === 'string' ? () => `${environment.apiUrl}/squads?country=${teamName}` : () => `${environment.apiUrl}/squads?country=${teamName()}`;
    const res = httpResource<any[]>(request, { injector: options?.injector });
    return computed(() => res.value()?.[0] || null);
  }

  getTeamByName(teamName: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof teamName === 'string' ? () => `${environment.apiBaseUrl}/items/teams?filter[name]=${encodeURIComponent(teamName)}&fields=id,name,flag_url,iso` : () => `${environment.apiBaseUrl}/items/teams?filter[name]=${encodeURIComponent(teamName())}&fields=id,name,flag_url,iso`;
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value()?.data || []);
  }

  getTeamColors(teamName: string | Signal<string>, options?: { injector?: Injector }) {
    const request = typeof teamName === 'string' ? () => `${environment.apiUrl}/teams?name=${teamName}&select=colors` : () => `${environment.apiUrl}/teams?name=${teamName()}&select=colors`;
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value() || []);
  }

  getTeamsInfo(teamisoname: string | Signal<string>, options?: { injector?: Injector }) {
    const request = computed(() => {
      const val = typeof teamisoname === 'string' ? teamisoname : teamisoname();
      return val ? `${environment.apiUrl}/teams?iso=${val}` : undefined;
    });
    const res = httpResource<any>(request, { injector: options?.injector });
    return computed(() => res.value());
  }
}
