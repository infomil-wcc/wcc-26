import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamPerformanceComponent } from '../../../team-performance/team-performance.component';
import { NumberInputComponent } from '../../../number-input/number-input.component';

@Component({
  selector: 'app-match-prediction-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, TeamPerformanceComponent, NumberInputComponent],
  templateUrl: './match-prediction-edit.component.html',
  styleUrl: './match-prediction-edit.component.scss'
})
export class MatchPredictionEditComponent {
  @Input() match!: any;
  @Input() teamAFlag!: string;
  @Input() teamBFlag!: string;
  @Input() matchOutcome!: string;
  @Input() canEditPrediction!: boolean;
  @Input() canEditScores!: boolean;
  @Input() canSelectScorer!: boolean;
  @Input() hidePointsBadge!: boolean;
  @Input() closed!: boolean;
  @Input() donePronostique!: any;
  @Input() halfTimeA!: number | null;
  @Input() halfTimeB!: number | null;
  @Input() fullTimeA!: number | null;
  @Input() fullTimeB!: number | null;
  @Input() scorer!: string;
  @Input() penaltyWinner!: string | null;
  @Input() invalidatedDate!: Date;
  @Input() matchPoints!: number | null;
  @Input() isConsolationPointAwarded!: boolean;
  @Input() userTrigramme!: string;
  @Input() isSavedInApi!: boolean;
  @Input() isEditing!: boolean;

  @Output() onSelectWinner = new EventEmitter<string>();
  @Output() onSelectPenaltyWinner = new EventEmitter<string>();
  @Output() halfTimeAChange = new EventEmitter<number | null>();
  @Output() halfTimeBChange = new EventEmitter<number | null>();
  @Output() fullTimeAChange = new EventEmitter<number | null>();
  @Output() fullTimeBChange = new EventEmitter<number | null>();
  @Output() onScoreChanged = new EventEmitter<void>();
  @Output() onHalftimeScoreChanged = new EventEmitter<void>();
  @Output() onOpenTacticalLineup = new EventEmitter<void>();
  @Output() onShowTeamDetails = new EventEmitter<{team: string, event: Event}>();

  selectWinner(team: string) {
    this.onSelectWinner.emit(team);
  }

  selectPenaltyWinner(team: string) {
    this.onSelectPenaltyWinner.emit(team);
  }

  showTeamDetails(team: string, event: Event) {
    this.onShowTeamDetails.emit({team, event});
  }

  openTacticalLineup() {
    this.onOpenTacticalLineup.emit();
  }

  handleHalfTimeAChange(val: number | null) {
    this.halfTimeAChange.emit(val);
  }

  handleHalfTimeBChange(val: number | null) {
    this.halfTimeBChange.emit(val);
  }

  handleFullTimeAChange(val: number | null) {
    this.fullTimeAChange.emit(val);
  }

  handleFullTimeBChange(val: number | null) {
    this.fullTimeBChange.emit(val);
  }

  triggerHalftimeScoreChanged() {
    this.onHalftimeScoreChanged.emit();
  }

  triggerScoreChanged() {
    this.onScoreChanged.emit();
  }
}
