import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { LoaderComponent } from '@shared/components/loader/loader.component';

import { Country } from '@shared/contracts/country.contract';

@Component({
  selector: 'app-country-details',
  standalone: true,
  templateUrl: './country-details.component.html',
  styleUrl: './country-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoaderComponent]
})
export class CountryDetailsComponent {
  @Input() country!: Country[];
}