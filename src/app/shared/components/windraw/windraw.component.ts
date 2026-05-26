import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-windraw',
  templateUrl: './windraw.component.html',
  styleUrl: './windraw.component.scss'
})
export class WindrawComponent {

  @Input() teamA!:string;
  @Input() teamB!:string;
  @Input() outCome!: string;
  @Input() disabled: boolean = false;
  @Input() phase!: string;

  @Output() outComeChange = new EventEmitter<string>();

  winDrawSelect(selected: string): void {
    this.outComeChange.emit(selected);
  }

}
