import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RankingcalculationService } from '../../../shared/services/core/rankingcalculation.service';
import { Observable, Subscription } from 'rxjs';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { HttpClient } from '@angular/common/http';
import { BracketService } from '../../../shared/services/games/bracket.service';
import { TeamsService } from '../../../shared/services/content/teams.service';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss'
})
export class RankingComponent implements OnInit, OnDestroy {

  private rankCalcService = inject(RankingcalculationService);
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

  private ranksSub!: Subscription;
  private bracketSub!: Subscription;
  private flagsSub!: Subscription;

  ngOnInit():void {
    this.$ranks = this.rankCalcService.getCurrentrankings();
    this.$bracketRanks = this.rankCalcService.getBracketRankings();

    this.ranksSub = this.$ranks.subscribe({
      next: (response)=>{
        if(response.length < 1){
          this.updateRanks();
          setTimeout(() => {
            location.reload();
          }, 3000);
        }

        let idx = response.length - 1;
        this.latestRank = response[idx];

        if(this.latestRank){
          this.showLoader = false;
        }
        this.cdr.detectChanges();
      }
    });

    this.bracketSub = this.$bracketRanks.subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.bracketRankingsList = res[0].ranking_json || [];
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

    this.rankCalcService.calcBracket();
    this.loadUserChampions();
  }

  loadUserChampions(): void {

    this.bracketService.getBrackets().subscribe({
      next: (data) => {
        if (data) {
          data.forEach((b: any) => {
            if (b.user && b.winner_wc) {
              const uKey = b.user.toLowerCase().trim();
              const country = b.winner_wc.trim();
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
    const list = this.activeList;
    // Return in order [2nd place, 1st place, 3rd place]
    return [
      list[1] || null,
      list[0] || null,
      list[2] || null
    ];
  }

  get remainingPlayers(): any[] {
    const list = this.activeList;
    return list.slice(3);
  }

  switchTab(tab: 'prediction' | 'bracket'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  updateRanks(): void {
    this.rankCalcService.startCalcRanking();
  }

  formatDate(date: Date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnDestroy(): void {
    if (this.ranksSub) this.ranksSub.unsubscribe();
    if (this.bracketSub) this.bracketSub.unsubscribe();
    if (this.flagsSub) this.flagsSub.unsubscribe();
  }
}
