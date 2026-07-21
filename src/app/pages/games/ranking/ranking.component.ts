import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { HttpClient } from '@angular/common/http';
import { BracketService } from '../../../shared/services/games/bracket.service';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { NgClass, UpperCasePipe, DatePipe } from '@angular/common';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { RankingsService } from '../../../shared/services/content/rankings.service';
import { StateService } from '../../../shared/services/core/state.service';
import { RouterModule } from '@angular/router';
import { ScoresheetComponent } from './scoresheet/scoresheet.component';
import { PointsCalculatorService } from '../../../shared/services/games/points-calculator.service';
import { TournamentStarApiService } from '../../../shared/services/api/tournament-star-api.service';
import { MeilleurJoueursApiService } from '../../../shared/services/api/meilleur-joueurs-api.service';
import { TotalGoalsApiService } from '../../../shared/services/api/total-goals-api.service';
import { PlayerMatcherService } from '../../../shared/services/games/player-matcher.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, LoaderComponent, UpperCasePipe, DatePipe, RouterModule, ScoresheetComponent]
})
export class RankingComponent implements OnInit, OnDestroy {
  protected selectedUserId: string | null = null;

  private rankingsService = inject(RankingsService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private http = inject(HttpClient);
  private bracketService = inject(BracketService);
  private cdr = inject(ChangeDetectorRef);
  private teamsService = inject(TeamsService);
  private pointsCalculatorService = inject(PointsCalculatorService);
  private tournamentStarApi = inject(TournamentStarApiService);
  private meilleurJoueursApi = inject(MeilleurJoueursApiService);
  private totalGoalsApi = inject(TotalGoalsApiService);
  private playerMatcher = inject(PlayerMatcherService);
  private today: Date = new Date();

  protected showLoader: boolean = true;
  protected $ranks!: Observable<any>;
  protected $bracketRanks!: Observable<any>;
  protected latestRank!: any;
  protected bracketRankingsList: any[] = [];
  protected activeTab: 'prediction' | 'bracket' | 'awards' = 'prediction';
  protected userChampions: { [username: string]: string } = {};
  protected flags: any[] = [];
  protected currentUserTrigramme: string = '';
  protected pinPosition: 'top' | 'bottom' | null = 'bottom';

  // Awards data
  protected tournamentStars: any = null;
  protected bestPlayerPredictions: any[] = [];
  protected totalGoalsList: any[] = [];
  protected dbPlayersList: any[] = [];
  protected processedAwards: any[] = [];
  protected hasLoadedAwards: boolean = false;

  private ranksSub!: Subscription;
  private bracketSub!: Subscription;
  private flagsSub!: Subscription;
  private userSub!: Subscription;
  ngOnInit(): void {
    this.userSub = this.stateService.userState.subscribe({
      next: (user) => {
        this.currentUserTrigramme = user.last_name || '';
        this.cdr.detectChanges();
        setTimeout(() => this.checkMyRowPosition(), 100);
      }
    });

    this.$ranks = this.rankingsService.getPronosticsRankings();
    this.$bracketRanks = this.rankingsService.getBracketRankings();

    this.ranksSub = this.$ranks.subscribe({
      next: (response) => {
        if (!response || response.length < 1) {
          this.updateRanks();
          setTimeout(() => {
            location.reload();
          }, 3000);
        }

        if (response && response.length > 0) {
          // Sort by rank ascending
          response.sort((a: any, b: any) => (a.rank || 1) - (b.rank || 1));
          this.latestRank = {
            ranking_json: response,
            modified_on: response[0].modified_on || new Date()
          };
          this.showLoader = false;
        }
        this.cdr.detectChanges();
        setTimeout(() => this.checkMyRowPosition(), 100);
      }
    });

    this.bracketSub = this.$bracketRanks.subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.bracketRankingsList = res || [];

        }
        this.cdr.detectChanges();
      }
    });

    this.flagsSub = this.teamsService.getFlags().subscribe({
      next: (flagsData) => {
        this.flags = flagsData;
        this.cdr.detectChanges();
      }
    });

    this.loadUserChampions();
  }

  loadUserChampions(): void {

    this.bracketService.getBrackets().subscribe({
      next: (data) => {
        if (data) {
          data.forEach((b: any) => {
            const predictions = b.predictions_json || {};
            const winner = b.winner_wc || predictions.winner_wc;
            if (b.user && winner) {
              const uKey = b.user.toLowerCase().trim();
              const country = winner.trim();
              this.userChampions[uKey] = country;
            }
          });
        }
        this.cdr.detectChanges();
      }
    });
  }

  getChampionCountry(username: string): string {
    if (!username) return '';
    const key = username.toLowerCase().trim();
    return this.userChampions[key] || '';
  }

  getPlayerFlag(player: any): string {
    if (!player) return 'assets/flags/unknown.png';
    const country = (player.country || player.team || player.team_name || '').toLowerCase().trim();
    if (country) {
      const flag = this.flags.find(f => f.name.toLowerCase().trim() === country);
      if (flag && flag.flag_url) {
        return flag.flag_url;
      }
    }
    return 'assets/flags/unknown.png';
  }

  formatPlayerName(name: string): string {
    return this.playerMatcher.formatPlayerName(name);
  }

  getChampionFlag(username: string): string {
    if (!username) return 'assets/flags/unknown.png';
    const key = username.toLowerCase().trim();
    const champ = this.userChampions[key];

    if (champ) {
      const flag = this.flags.find(f => f.name.toLowerCase().trim() === champ.toLowerCase().trim());
      if (flag && flag.flag_url) {
        return flag.flag_url;
      }
    }
    return 'assets/flags/unknown.png';
  }

  get activeList(): any[] {
    if (this.activeTab === 'prediction') {
      return this.latestRank?.ranking_json || [];
    } else {
      return this.bracketRankingsList || [];
    }
  }

  get topThree(): any[] {
    const list = this.activeListDeduplicated;
    // Return in order [2nd place, 1st place, 3rd place]
    return [
      list[1] || null,
      list[0] || null,
      list[2] || null
    ];
  }


  get activeListDeduplicated(): any[] {
    const list = this.activeList;
    if (!list || list.length === 0) return [];
    const uniquePlayers = new Map();
    list.forEach(p => {
      const key = (p.key || p.user || '').toLowerCase().trim();
      if (key && !uniquePlayers.has(key)) {
        uniquePlayers.set(key, p);
      }
    });
    return Array.from(uniquePlayers.values());
  }

  get remainingPlayers(): any[] {
    const list = this.activeListDeduplicated;
    if (this.showPodium) {
      return list.slice(3);
    } else {
      return list;
    }
  }

  get showPodium(): boolean {
    const list = this.activeList;
    if (list.length < 3) {
      return false; // Not enough players for a podium
    }

    const rank1Count = list.filter(player => player.rank === 1).length;
    const rank2Count = list.filter(player => player.rank === 2).length;
    const rank3Count = list.filter(player => player.rank === 3).length;

    // Show podium only if there's exactly one player for each of the top 3 ranks
    return rank1Count === 1 && rank2Count === 1 && rank3Count === 1;
  }

  canViewScoresheet(player: any): boolean {
    if (!this.currentUserTrigramme) return false;
    const name = (player.key || player.user || '').toLowerCase().trim();
    return name === this.currentUserTrigramme.toLowerCase().trim();
  }

  get shouldPinCurrentUser(): boolean {
    if (!this.currentUserTrigramme) return false;
    const list = this.activeList;
    if (list.length === 0) return false;

    // Check if the current user is in the active list
    const userIndex = list.findIndex(player => {
      const name = (player.key || player.user || '').toLowerCase().trim();
      return name === this.currentUserTrigramme.toLowerCase().trim();
    });

    if (userIndex === -1) return false;

    // "Do not do this if the podium is visible and and that I am on the podium"
    if (this.showPodium && userIndex < 3) {
      return false;
    }

    return true;
  }

  switchTab(tab: 'prediction' | 'bracket' | 'awards'): void {
    this.activeTab = tab;
    if (tab === 'awards' && !this.hasLoadedAwards) {
      this.loadAwards();
    }
    setTimeout(() => this.checkMyRowPosition(), 100);
  }

  loadAwards(): void {
    if (this.hasLoadedAwards) return;
    this.showLoader = true;
    
    // We need 4 things: tournament_star, meilleur_jouers, total_goals, wcc_players
    const p1 = this.tournamentStarApi.getTournamentStars('?limit=1').toPromise();
    const p2 = this.meilleurJoueursApi.getBestPlayers('?limit=-1').toPromise();
    const p3 = this.totalGoalsApi.getTotalGoals('?limit=-1').toPromise();
    const p4 = this.http.get<any>(`${environment.apiBaseUrl}/items/wcc_players?limit=-1`).toPromise();

    Promise.all([p1, p2, p3, p4]).then(([starRes, mjRes, tgRes, playersRes]) => {
      this.tournamentStars = starRes?.data?.[0] || {};
      this.bestPlayerPredictions = mjRes?.data || [];
      this.totalGoalsList = tgRes?.data || [];
      this.dbPlayersList = playersRes?.data || [];
      
      this.processAwardsData();
      
      this.hasLoadedAwards = true;
      this.showLoader = false;
      this.cdr.detectChanges();
    }).catch(err => {
      console.error('Failed to load awards data', err);
      this.showLoader = false;
      this.cdr.detectChanges();
    });
  }

  processAwardsData(): void {
    const trueBestPlayerStr = this.tournamentStars?.golden_ball_winner || '';
    const trueGoldenBootStr = this.tournamentStars?.golden_boot || '';

    // Match the true winners with dbPlayers to get their flags and exact names
    const bestPlayerMatch = this.playerMatcher.matchSingle(trueBestPlayerStr, this.dbPlayersList);
    const goldenBootMatch = this.playerMatcher.matchSingle(trueGoldenBootStr, this.dbPlayersList);

    const trueBestPlayer = bestPlayerMatch?.matchedPlayer;
    const trueGoldenBoot = goldenBootMatch?.matchedPlayer;

    this.processedAwards = this.bestPlayerPredictions.map(userPrediction => {
      // Fuzzy match user's predictions
      const userBestPlayerMatch = this.playerMatcher.matchSingle(userPrediction.meilleur_joueur, this.dbPlayersList);
      const userGoldenBootMatch = this.playerMatcher.matchSingle(userPrediction.meilleur_buteur, this.dbPlayersList);

      const userBP = userBestPlayerMatch?.matchedPlayer;
      const userGB = userGoldenBootMatch?.matchedPlayer;

      let bpCorrect = false;
      let gbCorrect = false;

      // Best Player check
      if (trueBestPlayer && userBP && trueBestPlayer.id === userBP.id) {
         bpCorrect = true;
      }

      // Golden Boot check with tie-breaker
      if (trueGoldenBoot && userGB && trueGoldenBoot.id === userGB.id) {
         gbCorrect = true;
      } else if (userGB && trueGoldenBoot) {
         // Ex-aequo logic
         const userGBGoals = this.totalGoalsList.find(tg => tg.player_id === userGB.id || this.playerMatcher.matchSingle(tg.player_name, [userGB])?.matchedPlayer?.id === userGB.id)?.goals || 0;
         const trueGBGoals = this.totalGoalsList.find(tg => tg.player_id === trueGoldenBoot.id || this.playerMatcher.matchSingle(tg.player_name, [trueGoldenBoot])?.matchedPlayer?.id === trueGoldenBoot.id)?.goals || 0;
         
         // If they have the exact same number of goals and it's > 0, we can consider it correct if it's tied for top scorer
         if (userGBGoals > 0 && userGBGoals === trueGBGoals) {
             // Technically we should check if they are the MAXIMUM goals, but trueGBGoals is the official winner's goals
             gbCorrect = true;
         }
      }

      const gbGoals = Number(userPrediction.nombre_but) || 0;

      // Look up user's total tournament goals prediction from total_goals collection (matched by trigramme/user)
      const userTotalGoalsEntry = this.totalGoalsList.find(tg => 
        (tg.trigramme || tg.user || '').toLowerCase().trim() === (userPrediction.user || '').toLowerCase().trim()
      );
      const totalGoalsPredicted = userTotalGoalsEntry ? Number(userTotalGoalsEntry.goals) || 0 : 0;
      
      const tournamentTotalGoals = Number(this.tournamentStars?.tournament_total_goals) || 0;
      const goalDelta = (totalGoalsPredicted && tournamentTotalGoals) ? totalGoalsPredicted - tournamentTotalGoals : 0;

      const officialGbGoals = Number(this.tournamentStars?.goals) || 0;
      const gbGoalsCorrect = gbCorrect && officialGbGoals > 0 && gbGoals === officialGbGoals;
      const absGoalDelta = totalGoalsPredicted ? Math.abs(goalDelta) : 999999;

      return {
        user: userPrediction.user,
        bestPlayerName: userPrediction.meilleur_joueur,
        bestPlayerMatched: userBP,
        bestPlayerCorrect: bpCorrect,
        goldenBootName: userPrediction.meilleur_buteur,
        goldenBootMatched: userGB,
        goldenBootCorrect: gbCorrect,
        gbGoals,
        gbGoalsCorrect,
        totalGoalsPredicted,
        goalDelta,
        absGoalDelta
      };
    });

    // Custom sorting rules:
    // 1. Correct golden boot & correct number of goals
    // 2. Correct golden boot
    // 3. Total correct awards (Best Player / Golden Boot)
    // 4. Lowest absolute delta from total tournament goals
    // 5. Username (alphabetical)
    this.processedAwards.sort((a, b) => {
      const aFullGB = (a.goldenBootCorrect && a.gbGoalsCorrect) ? 1 : 0;
      const bFullGB = (b.goldenBootCorrect && b.gbGoalsCorrect) ? 1 : 0;
      if (bFullGB !== aFullGB) return bFullGB - aFullGB;

      const aGB = a.goldenBootCorrect ? 1 : 0;
      const bGB = b.goldenBootCorrect ? 1 : 0;
      if (bGB !== aGB) return bGB - aGB;

      const aTotalCorrect = (a.bestPlayerCorrect ? 1 : 0) + (a.goldenBootCorrect ? 1 : 0);
      const bTotalCorrect = (b.bestPlayerCorrect ? 1 : 0) + (b.goldenBootCorrect ? 1 : 0);
      if (bTotalCorrect !== aTotalCorrect) return bTotalCorrect - aTotalCorrect;

      if (a.absGoalDelta !== b.absGoalDelta) return a.absGoalDelta - b.absGoalDelta;

      return a.user.localeCompare(b.user);
    });
    
    // Attach to tournamentStars for template
    this.tournamentStars.trueBestPlayer = trueBestPlayer;
    this.tournamentStars.trueGoldenBoot = trueGoldenBoot;
  }

  updateRanks(): void {
    console.log('Automated recalculations are disabled from RankingComponent. Trigger them from Admin Dashboard.');
    return;
    this.rankingsService.recalculateRankings().subscribe({
      next: () => {
        console.log('Rankings recalculated on backend.');
      },
      error: (err) => {
        console.error('Failed to recalculate rankings on backend:', err);
      }
    });
  }

  formatDate(date: Date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.checkMyRowPosition();
  }

  checkMyRowPosition() {
    if (!this.shouldPinCurrentUser) {
      this.pinPosition = null;
      return;
    }

    const sentinelEl = document.querySelector('.row-sentinel');
    if (!sentinelEl) {
      this.pinPosition = 'bottom';
      return;
    }

    const rect = sentinelEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Sticky header and tabs stick to the top.
    // Desktop: header + tabs ends at 260px. Sticky top at 272px.
    // Mobile: header + tabs ends at 242px. Sticky top at 254px.
    const isMobile = window.innerWidth <= 640;
    const topBoundary = isMobile ? 254 : 272;
    const bottomBoundary = viewportHeight - 100;

    if (rect.top < topBoundary) {
      this.pinPosition = 'top';
    } else if (rect.bottom > bottomBoundary) {
      this.pinPosition = 'bottom';
    } else {
      this.pinPosition = null;
    }
    this.cdr.detectChanges();
  }

  openScoresheet(userId: string) {
    this.selectedUserId = userId;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.ranksSub) this.ranksSub.unsubscribe();
    if (this.bracketSub) this.bracketSub.unsubscribe();
    if (this.flagsSub) this.flagsSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }
}
