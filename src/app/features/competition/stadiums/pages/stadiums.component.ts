import { Component, OnInit, inject, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
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
    imports: [NgClass, LoaderComponent, StadiumDetailsComponent]
})
export class StadiumsComponent implements OnInit {

  private stadiumService = inject(StadiumsService);
  private platformId = inject(PLATFORM_ID);

  protected choosenStadium!: any | null;
  protected stadiumData = computed(() => this.stadiumService.stadiums());

  ngOnInit(){
  }

  showStadium(stadium: Stadium): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
    this.choosenStadium = stadium;
  }
}
