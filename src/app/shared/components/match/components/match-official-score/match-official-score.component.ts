import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-match-official-score',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-official-score.component.html',
  styleUrl: './match-official-score.component.scss'
})

export class MatchOfficialScoreComponent {
  @Input() match!: any;
  @Input() teamAFlag!: string;
  @Input() teamBFlag!: string;
  @Input() isScorersJson!: boolean;
  @Input() teamAScorersGrouped!: any[];
  @Input() teamBScorersGrouped!: any[];

  formatTeamName(name: string | undefined | null): string {
    if (!name) return '';
    return name.substring(0, 3).toUpperCase();
  }
}
