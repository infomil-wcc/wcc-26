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

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, LoaderComponent, UpperCasePipe, DatePipe]
})
export class RankingComponent implements OnInit, OnDestroy {

  private rankingsService = inject(RankingsService);
  private stateService = inject(StateService);
  private globalTime = inject(GlobaltimeService);
  private http = inject(HttpClient);
  private bracketService = inject(BracketService);
  private cdr = inject(ChangeDetectorRef);
  private teamsService = inject(TeamsService);
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

    this.$ranks = this.rankingsService.getPronosticsRankings();
    this.$bracketRanks = this.rankingsService.getBracketRankings();

    this.ranksSub = this.$ranks.subscribe({
      next: (response)=>{
        if(!response || response.length < 1){
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

  ngOnDestroy(): void {
    if (this.ranksSub) this.ranksSub.unsubscribe();
    if (this.bracketSub) this.bracketSub.unsubscribe();
    if (this.flagsSub) this.flagsSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }
}
