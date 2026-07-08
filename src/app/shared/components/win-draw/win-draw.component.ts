import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-win-draw',
    templateUrl: './win-draw.component.html',
    styleUrl: './win-draw.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
})
export class WinDrawComponent {

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
