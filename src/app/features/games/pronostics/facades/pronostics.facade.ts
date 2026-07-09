import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatchesService } from '../../../../core/services/content/matches.service';
import { StateService } from '../../../../core/services/core/state.service';
import { GlobaltimeService } from '../../../../core/services/core/global-time.service';
import { PredictionsService } from '../../../../core/services/games/predictions.service';
import { RankingsService } from '../../../../core/services/content/rankings.service';
import { TeamsService } from '../../../../core/services/content/teams.service';
import { Observable } from 'rxjs';
import { Matches } from '../../../../shared/contracts/matches.contract';

@Injectable({
  providedIn: 'root'
})
export class PronosticsFacade {
  private matchesService = inject(MatchesService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private predictionService = inject(PredictionsService);
  private rankingsService = inject(RankingsService);
  private teamService = inject(TeamsService);

  // States managed by the Facade
  private filterDateSignal = signal<string | null>(null);
  private activeTabSignal = signal<'live' | 'upcoming' | 'played'>('upcoming');

  public filterDate$ = toObservable(this.filterDateSignal);
  public activeTab$ = toObservable(this.activeTabSignal);

  // Observables/Properties
  public userState$ = this.stateService.userState;
  public drafts$ = this.predictionService.drafts$;

  // Filter state getters/setters
  getFilterDate(): string | null {
    return this.filterDateSignal();
  }

  setFilterDate(date: string | null): void {
    this.filterDateSignal.set(date);
  }

  getActiveTab(): 'live' | 'upcoming' | 'played' {
    return this.activeTabSignal();
  }

  setActiveTab(tab: 'live' | 'upcoming' | 'played'): void {
    this.activeTabSignal.set(tab);
  }

  // MatchesService delegation
  getAllMatches(): Observable<Matches[]> {
    return this.matchesService.getAllMatches();
  }

  // GlobalTimeService delegation
  getMuTime(): Observable<any> {
    return this.globalTime.getMuTime();
  }

  // PredictionsService delegation
  getMyPredictions(params: string): Observable<any[]> {
    return this.predictionService.getMyPredictions(params);
  }

  getDrafts() {
    return this.predictionService.getDrafts();
  }

  addDraft(draft: any) {
    this.predictionService.addDraft(draft);
  }

  sendPrediction(draft: any, kickoffTime: string) {
    return this.predictionService.sendPrediction(draft, kickoffTime);
  }

  markAsSaved(gameId: any, data: any) {
    this.predictionService.markAsSaved(gameId, data);
  }

  clearDrafts() {
    this.predictionService.clearDrafts();
  }

  clearSavedPredictions() {
    this.predictionService.clearSavedPredictions();
  }

  triggerRefresh() {
    this.predictionService.triggerRefresh();
  }

  // RankingsService delegation
  getUserRanking(username: string): Observable<any> {
    return this.rankingsService.getUserRanking(username);
  }

  // TeamsService delegation
  getTeamByName(teamName: string) {
    return this.teamService.getTeamByName(teamName);
  }
}
