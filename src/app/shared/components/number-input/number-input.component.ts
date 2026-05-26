import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-number-input',
  templateUrl: './number-input.component.html',
  styleUrl: './number-input.component.scss'
})
export class NumberInputComponent {

  @Input() num!: number;
  @Input() disabled: boolean = false;
  @Output() numChange = new EventEmitter<number>();

  increment() {
    if (this.num < 99) {
      this.num++;
      this.numChange.emit(this.num);
    }
  }

  decrement() {
    if (this.num > 0) {
      this.num--;
      this.numChange.emit(this.num);
    }
  }

  onchange(num: number){
    this.numChange.emit(num);
  }
}
