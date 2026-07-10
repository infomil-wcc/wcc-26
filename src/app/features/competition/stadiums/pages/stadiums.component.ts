import { Component, OnInit, inject, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { breadCrump, BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { Observable, map } from 'rxjs';
import { StadiumsService } from '../../../../core/services/content/stadiums.service';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { StadiumDetailsComponent } from '../components/stadium-details/stadium-details.component';
import { computed } from '@angular/core';

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
    imports: [BreadcrumbComponent, NgClass, LoaderComponent, StadiumDetailsComponent]
})
export class StadiumsComponent implements OnInit {

  private stadiumService = inject(StadiumsService);
  private platformId = inject(PLATFORM_ID);

  protected breadCrumpDefault: breadCrump[] = [{label: 'Les Stades', route: 'closeSadiumDetails', active: true }];
  protected breadCrumpData: breadCrump[] = [];
  protected choosenStadium!: any | null;
  protected stadiumData = computed(() => this.stadiumService.stadiums());

  ngOnInit(){
    this.breadCrumpData = this.breadCrumpDefault;

  }

  showStadium( stadium: Stadium): void {
    this.breadCrumpData = [];
    this.breadCrumpDefault[0].active = false;
    this.breadCrumpData.push(this.breadCrumpDefault[0], {label: stadium.title, route: '', active: true });
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
    this.choosenStadium = stadium;
  }


  resetStadiumSelection(ev: string): void {
    if(ev === 'closeSadiumDetails') {
      this.breadCrumpData = [];
      this.breadCrumpData.push(this.breadCrumpDefault[0]);
      this.choosenStadium = null;
    }
  }

}
