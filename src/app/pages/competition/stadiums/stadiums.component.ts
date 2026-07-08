import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { breadCrump, BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { Observable, map } from 'rxjs';
import { StadiumsService } from '../../../core/services/content/stadiums.service';
import { NgClass, AsyncPipe } from '@angular/common';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { StadiumDetailsComponent } from '../../../shared/components/stadium-details/stadium-details.component';

export interface Stadium {
  id: string;
  title: string;
  description: string;
  showDetails: boolean;
}
@Component({
    selector: 'app-stadiums',
    templateUrl: './stadiums.component.html',
    styleUrl: './stadiums.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BreadcrumbComponent, NgClass, LoaderComponent, StadiumDetailsComponent, AsyncPipe]
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
