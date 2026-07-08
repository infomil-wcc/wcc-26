import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamperformanceComponent } from '../../../teamperformance/teamperformance.component';

@Component({
  selector: 'app-match-info',
  standalone: true,
  imports: [CommonModule, TeamperformanceComponent],
  templateUrl: './match-info.component.html',
  styleUrl: './match-info.component.scss'
})
export class MatchInfoComponent {
  @Input() match!: any;
  @Input() teamAFlag!: string;
  @Input() teamBFlag!: string;
  @Output() onShowTeamDetails = new EventEmitter<{team: string, event: Event}>();

  showTeamDetails(team: string, event: Event) {
    this.onShowTeamDetails.emit({team, event});
  }
}
