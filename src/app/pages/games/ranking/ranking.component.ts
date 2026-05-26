import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RankingcalculationService } from '../../../shared/services/core/rankingcalculation.service';
import { Observable, last } from 'rxjs';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss'
})
export class RankingComponent implements OnInit, OnDestroy {

  private rankCalcSercvice = inject(RankingcalculationService);
  private globalTime = inject(GlobaltimeService);
  private today: Date = new Date();

  protected showLoader: boolean = true;
  protected $ranks!: Observable<any>;
  protected $bracketRanks!: Observable<any>;
  protected latestRank!: any;

  ngOnInit():void {
    this.$ranks = this.rankCalcSercvice.getCurrentrankings();
    this.$bracketRanks = this.rankCalcSercvice.getBracketRankings();

    this.$ranks.subscribe({
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
      }
    })

    this.rankCalcSercvice.calcBracket();
  }

  updateRanks(): void {
    this.rankCalcSercvice.startCalcRanking();
  }

  formatDate(date: Date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnDestroy(): void {
    this.$ranks.subscribe().unsubscribe();
  }
}
