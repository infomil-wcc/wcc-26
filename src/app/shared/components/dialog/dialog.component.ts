import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-dialog',
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DialogComponent {
  @Input() showDialog?: boolean;
  @Input() dialogTitle: string = '';
  @Input() withOverlay: boolean = false;
  @Output() showDialogChange = new EventEmitter<boolean>();
  @Input() allowClose: boolean = true;


  closeDialog() {
    this.showDialog = false;
    this.showDialogChange.emit(this.showDialog);
  }
}
