import { Injectable, inject, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Matches } from '../../shared/contracts/matches.contract';
import { TeamsService } from '../services/content/teams.service';
import { PredictionsService } from '../services/games/predictions.service';
import { StateService } from '../services/core/state.service';
import { GlobaltimeService } from '../services/core/global-time.service';
import { StadiumsService } from '../services/content/stadiums.service';
import { LineupsApiService } from '../services/api/lineups-api.service';
import { MatchesService } from '../services/content/matches.service';
import { MatchScorersService } from '../services/games/match-scorers.service';
import { MatchOutcomeService } from '../services/games/match-outcome.service';
import { MatchCountdownService } from '../services/games/match-countdown.service';

@Injectable({
  providedIn: 'root'
})
export class MatchFacade {
  private teamsService = inject(TeamsService);
  private predictionsService = inject(PredictionsService);
  private stateService = inject(StateService);
  private globalTimeService = inject(GlobaltimeService);
  private stadiumsService = inject(StadiumsService);
  private lineupsService = inject(LineupsApiService);
  private matchesService = inject(MatchesService);
  private matchScorersService = inject(MatchScorersService);
  private matchOutcomeService = inject(MatchOutcomeService);
  private matchCountdownService = inject(MatchCountdownService);
  private injector = inject(Injector);

  // Expose Observables/Properties
  public userState$ = this.stateService.userState;
  public refresh$ = this.predictionsService.refresh$;
  public savedPredictions$ = this.predictionsService.savedPredictions$;

  // TeamsService delegation
  getPlayersByTeamName(teamName: string) {
    return toObservable(this.teamsService.getPlayersByTeamName(teamName, { injector: this.injector }), { injector: this.injector });
  }

  getTeamByName(teamName: string) {
    return toObservable(this.teamsService.getTeamByName(teamName, { injector: this.injector }), { injector: this.injector });
  }

  getFlags() {
    return toObservable(this.teamsService.flags, { injector: this.injector });
  }

  // PredictionsService delegation
  removeDraft(matchId: any) {
    this.predictionsService.removeDraft(matchId);
  }

  updateMatchResults(matchId: string) {
    return this.predictionsService.updateMatchResults(matchId);
  }

  updateResults() {
    return this.predictionsService.updateResults();
  }

  addDraft(prediction: any) {
    this.predictionsService.addDraft(prediction);
  }

  getDrafts() {
    return this.predictionsService.getDrafts();
  }

  getMyPredictions(matchId: any) {
    return this.predictionsService.getMyPredictions(matchId);
  }

  triggerRefresh() {
    this.predictionsService.triggerRefresh();
  }

  // GlobalTimeService delegation
  getMuTime() {
    return this.globalTimeService.getMuTime();
  }

  // StadiumsService delegation
  getStadium() {
    return toObservable(this.stadiumsService.stadiums, { injector: this.injector });
  }

  // LineupsApiService delegation
  getLineups(teamA: string, teamB: string) {
    return this.lineupsService.getLineups(teamA, teamB);
  }

  // MatchesService delegation
  getAllMatches(): Observable<Matches[]> {
    return toObservable(this.matchesService.allMatches, { injector: this.injector }) as Observable<Matches[]>;
  }

  // MatchScorersService delegation
  isMatchScorersJson(match: any) {
    return this.matchScorersService.isMatchScorersJson(match);
  }

  isScorerCorrect(scorer: string, match: any) {
    return this.matchScorersService.isScorerCorrect(scorer, match);
  }

  getMatchScorersGrouped(match: any, teamName: string) {
    return this.matchScorersService.getMatchScorersGrouped(match, teamName);
  }

  // MatchOutcomeService delegation
  calculateWinDraw(phase: string, penaltyWinner: string | null, teamA: string, teamB: string, fullTimeA: number | null, fullTimeB: number | null) {
    return this.matchOutcomeService.calculateWinDraw(phase, penaltyWinner, teamA, teamB, fullTimeA, fullTimeB);
  }

  isMatchFinishedByDate(matchDate: string, today: Date) {
    return this.matchOutcomeService.isMatchFinishedByDate(matchDate, today);
  }

  isOutcomeCorrect(donePronostique: any, match: any, hidePointsBadge: boolean) {
    return this.matchOutcomeService.isOutcomeCorrect(donePronostique, match, hidePointsBadge);
  }

  isFulltimeCorrect(donePronostique: any, match: any, hidePointsBadge: boolean) {
    return this.matchOutcomeService.isFulltimeCorrect(donePronostique, match, hidePointsBadge);
  }

  isHalftimeCorrect(donePronostique: any, match: any, hidePointsBadge: boolean) {
    return this.matchOutcomeService.isHalftimeCorrect(donePronostique, match, hidePointsBadge);
  }

  getMatchPoints(donePronostique: any, match: any, hidePointsBadge: boolean) {
    return this.matchOutcomeService.getMatchPoints(donePronostique, match, hidePointsBadge);
  }

  isConsolationPointAwarded(donePronostique: any, match: any, hidePointsBadge: boolean) {
    return this.matchOutcomeService.isConsolationPointAwarded(donePronostique, match, hidePointsBadge);
  }

  // MatchCountdownService delegation
  getCountdownState(date: string, current_status: string | undefined, played: boolean, timeOffset: number) {
    return this.matchCountdownService.getCountdownState(date, current_status, played, timeOffset);
  }
}
