import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
    selector: 'modal',
    templateUrl: './modal.component.html',
    styleUrl: './modal.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
})


export class ModalComponent {

  @Input() modalSize: 'sm' | 'md' | 'lg' = 'md';
  @Input() showModal: boolean = false;
  @Input() showCloseButton: boolean = true;
  @Output() showModalChange = new EventEmitter<boolean>();

  closeModal() {
    this.showModal = false;
    this.showModalChange.emit(this.showModal);
  }

  openModal() {
    this.showModal = true;
    this.showModalChange.emit(this.showModal);
  }

}
