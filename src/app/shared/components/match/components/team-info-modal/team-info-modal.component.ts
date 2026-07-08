import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-team-info-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './team-info-modal.component.html',
  styleUrl: './team-info-modal.component.scss'
})
export class TeamInfoModalComponent {
  @Input() showTeamInfoModal!: boolean;
  @Input() selectedTeamName!: string;
  @Input() loadingTeamInfo!: boolean;
  @Input() teamPastMatches!: any[];

  @Output() onCloseModal = new EventEmitter<void>();

  closeModal() {
    this.onCloseModal.emit();
  }
}
