import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-windraw',
    templateUrl: './windraw.component.html',
    styleUrl: './windraw.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
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
