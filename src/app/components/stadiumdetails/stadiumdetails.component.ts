import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Stadium } from '../../pages/competition/stadiums/stadiums.component';

@Component({
    selector: 'stadiumdetails',
    templateUrl: './stadiumdetails.component.html',
    styleUrl: './stadiumdetails.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class StadiumdetailsComponent {

  @Input() stadium!: Stadium;
}
