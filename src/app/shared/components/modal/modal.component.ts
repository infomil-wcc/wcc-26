import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'modal',
    templateUrl: './modal.component.html',
    styleUrl: './modal.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
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
