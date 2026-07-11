import { Injectable, Injector, Signal, computed, inject, signal } from '@angular/core';
import { TeamsService } from '../../../core/services/content/teams.service';
import { MatchesService } from '../../../core/services/content/matches.service';
import { GlobaltimeService } from '../../../core/services/core/global-time.service';
import { Teams } from '../../../shared/contracts/teams.contract';
import { Matches } from '../../../shared/contracts/matches.contract';
import { Country } from './components/country-details/country-details.component';
import { sortTeamsByName, addShowDetailsProperty, sortCountryTimeline } from './utils/teams.utils';

@Injectable({
  providedIn: 'root'
})
export class TeamsFacade {
  private teamsService = inject(TeamsService);
  private matchesService = inject(MatchesService);
  private globalTime = inject(GlobaltimeService);
  private injector = inject(Injector);

  // State signals
  private _selectedTeam = signal<Teams | null>(null);
  
  // Public signals
  public selectedTeam = this._selectedTeam.asReadonly();
  
  public teamsData = computed(() => {
    const rawTeams = this.teamsService.allTeams();
    if (!rawTeams) return [];
    return sortTeamsByName(addShowDetailsProperty(rawTeams));
  });

  public today = computed(() => {
    // Wait, getMuTime returns an Observable. We probably shouldn't hold an Observable in a Signal,
    // or we can convert it using toSignal if we want.
    // For now, let's keep exposing the Observable or convert to signal.
    // Since getMuTime() returns Observable<any>, let's just return it from a getter.
    return this.globalTime.getMuTime();
  });

  private _selectedTeamName = computed(() => {
    const team = this._selectedTeam();
    return team ? team.name : '';
  });

  private _selectedTeamIso = computed(() => {
    const team = this._selectedTeam();
    return team ? team.iso : '';
  });

  public selectedTeamMatches = this.matchesService.getMatchesByTeam(this._selectedTeamName, { injector: this.injector });

  private _selectedTeamDetailsSignal = this.teamsService.getTeamsInfo(this._selectedTeamIso, { injector: this.injector });

  public selectedTeamDetails = computed(() => {
    const countries = this._selectedTeamDetailsSignal();
    return sortCountryTimeline(countries || []);
  });

  // Actions
  public selectTeam(team: Teams): void {
    this._selectedTeam.set(team);
  }

  public clearSelection(): void {
    this._selectedTeam.set(null);
  }
}
