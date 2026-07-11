import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, HostListener, PLATFORM_ID, Injector } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { GlobaltimeService } from '../../../../core/services/core/global-time.service';
import { HttpClient } from '@angular/common/http';
import { BracketService } from '../../../../core/services/games/bracket.service';
import { TeamsService } from '../../../../core/services/content/teams.service';
import { NgClass, UpperCasePipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { RankingsService } from '../../../../core/services/content/rankings.service';
import { StateService } from '../../../../core/services/core/state.service';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { ScoresheetComponent } from './scoresheet/scoresheet.component';


@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, LoaderComponent, UpperCasePipe, DatePipe, RouterModule, ScoresheetComponent]
})
export class LeaderboardComponent implements OnInit, OnDestroy {

  protected selectedUserId: string | null = null;

  private rankingsService = inject(RankingsService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private http = inject(HttpClient);
  private bracketService = inject(BracketService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private teamsService = inject(TeamsService);
  private injector = inject(Injector);
  private today: Date = new Date();

  protected showLoader: boolean = true;
  protected $ranks!: Observable<any>;
  protected $bracketRanks!: Observable<any>;
  protected latestRank!: any;
  protected bracketRankingsList: any[] = [];
  protected activeTab: 'prediction' | 'bracket' = 'prediction';
  protected userChampions: { [username: string]: string } = {};
  protected flags: any[] = [];
  protected currentUserTrigramme: string = '';
  protected pinPosition: 'top' | 'bottom' | null = 'bottom';

  private ranksSub!: Subscription;
  private bracketSub!: Subscription;
  private flagsSub!: Subscription;
  private userSub!: Subscription;
  ngOnInit():void {
    this.userSub = this.stateService.userState.subscribe({
      next: (user) => {
        this.currentUserTrigramme = user.last_name || '';
        this.cdr.detectChanges();
        setTimeout(() => this.checkMyRowPosition(), 100);
      }
    });

    this.$ranks = toObservable(this.rankingsService.pronosticsRankings, { injector: this.injector });
    this.$bracketRanks = toObservable(this.rankingsService.bracketRankings, { injector: this.injector });

    this.ranksSub = this.$ranks.subscribe({
      next: (response)=>{
        if(!response || response.length < 1){
          this.updateRanks();
          setTimeout(() => {
            this.rankingsService.reloadPronostics();
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

    this.flagsSub = toObservable(this.teamsService.flags, { injector: this.injector }).subscribe({
      next: (flagsData: any) => {
        this.flags = flagsData;
        this.cdr.detectChanges();
      }
    });

    this.loadUserChampions();
  }

  loadUserChampions(): void {

    toObservable(this.bracketService.brackets, { injector: this.injector }).subscribe({
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

  switchTab(tab: 'prediction' | 'bracket'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
    setTimeout(() => this.checkMyRowPosition(), 100);
  }

  updateRanks(): void {
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
    const viewportHeight = isPlatformBrowser(this.platformId) ? window.innerHeight : 0;
    const isMobile = isPlatformBrowser(this.platformId) ? window.innerWidth <= 640 : false;
    const topBoundary = isMobile ? 256 : 231;
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
