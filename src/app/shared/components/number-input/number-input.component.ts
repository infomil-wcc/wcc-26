import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-number-input',
    templateUrl: './number-input.component.html',
    styleUrl: './number-input.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ReactiveFormsModule, FormsModule]
})
export class NumberInputComponent {

  @Input() num: any = null;
  @Input() disabled: boolean = false;
  @Output() numChange = new EventEmitter<any>();

  increment() {
    if (this.num === null || this.num === undefined) {
      this.num = 0;
    } else if (this.num < 99) {
      this.num++;
    }
    this.numChange.emit(this.num);
  }

  decrement() {
    if (this.num === null || this.num === undefined) {
      this.num = 0;
    } else if (this.num > 0) {
      this.num--;
    }
    this.numChange.emit(this.num);
  }

  onchange(num: number | null) {
    this.numChange.emit(num);
  }
}
