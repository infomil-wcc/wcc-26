import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { LoaderComponent } from '../loader/loader.component';
import { AsyncPipe } from '@angular/common';

export interface Country {
  name: string;
  iso: string;
  group: string;
  coach: string;
  worldCupAppearances: number;
  worldCupGoals: number;

  bestResult: {
    en: string;
  };

  internationalTitles: string[];

  qualification2026: {
    topScorer: string;
    topAssists: string;
    mostUsed:  string;
    chancesCreated: string;
    note: { en: string };
  };

  funFacts: {
    text: { en: string };
    emoji: string;
  }[];

  timeline: {
    year: number;
    text: { en: string };
  }[];
}

@Component({
    selector: 'app-country-details',
    templateUrl: './country-details.component.html',
    styleUrl: './country-details.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LoaderComponent, AsyncPipe]
})
export class CountryDetailsComponent {

  @Input() $country!: Observable<Country[]>;

  ngOnInit(): void {
    // this.$country.subscribe({
    //   next: (response: Country[]) => {
    //     console.log(response);
    //   }
    // });
  }

}
