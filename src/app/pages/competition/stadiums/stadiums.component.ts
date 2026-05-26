import { Component, OnInit, inject } from '@angular/core';
import { breadCrump } from '../../../shared/components/breadcrump/breadcrump.component';
import { Observable, map } from 'rxjs';
import { StadiumsService } from '../../../shared/services/content/stadiums.service';

export interface Stadium {
  id: string;
  title: string;
  description: string;
  showDetails: boolean;
}
@Component({
  selector: 'app-stadiums',
  templateUrl: './stadiums.component.html',
  styleUrl: './stadiums.component.scss'
})
export class StadiumsComponent implements OnInit {

  private stadiumService = inject(StadiumsService);

  protected breadCrumpDefault: breadCrump[] = [{label: 'Les Stades', route: 'closeSadiumDetails', active: true }];
  protected breadCrumpData: breadCrump[] = [];
  protected choosenStadium!: any | null;
  protected $stadiumData!: Observable<Stadium[]>;

  ngOnInit(){
    this.breadCrumpData = this.breadCrumpDefault;
    this.setStadiumData();
  }

  showStadium( stadium: Stadium): void {
    this.breadCrumpData = [];
    this.breadCrumpDefault[0].active = false;
    this.breadCrumpData.push(this.breadCrumpDefault[0], {label: stadium.title, route: '', active: true });
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    this.choosenStadium = stadium;
  }


  setStadiumData(): void {
    this.$stadiumData = this.stadiumService.getStadium()
    // .pipe(
    //   map((stadium: Stadium[]) => {
    //     stadium.forEach((stade: any) => stade.showDetails = false);
    //     // Sorting details of stadium by title
    //     return stadium.sort((a: { id: string; }, b: { id: any; }) => a.id.localeCompare(b.id));
    //   })
    // )
  }

  resetStadiumSelection(ev: string): void {
    if(ev === 'closeSadiumDetails') {
      this.breadCrumpData = [];
      this.breadCrumpData.push(this.breadCrumpDefault[0]);
      this.setStadiumData();
      this.choosenStadium = null;
    }
  }

}
