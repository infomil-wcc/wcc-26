import { Component, Input } from '@angular/core';
import { Stadium } from '../../pages/competition/stadiums/stadiums.component';

@Component({
  selector: 'stadiumdetails',
  templateUrl: './stadiumdetails.component.html',
  styleUrl: './stadiumdetails.component.scss'
})
export class StadiumdetailsComponent {

  @Input() stadium!: Stadium;
}
