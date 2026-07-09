import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Stadium } from '../../pages/stadiums.component';

@Component({
    selector: 'app-stadium-details',
    templateUrl: './stadium-details.component.html',
    styleUrl: './stadium-details.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class StadiumDetailsComponent {

  @Input() stadium!: Stadium;
}
