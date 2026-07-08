import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-match-prediction-saved',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-prediction-saved.component.html',
  styleUrl: './match-prediction-saved.component.scss'
})
export class MatchPredictionSavedComponent {
  @Input() match!: any;
  @Input() donePronostique!: any;
  @Input() closed!: boolean;
  @Input() isSavedInApi!: boolean;
  @Input() isEditing!: boolean;
  @Input() hidePointsBadge!: boolean;
  @Input() countdownText!: string;
  @Input() isMatchFinishedByDate!: boolean;
  @Input() disabled!: boolean;
  @Input() isSubmitting!: boolean;
  
  @Input() isOutcomeCorrectVal!: boolean;
  @Input() isFulltimeCorrectVal!: boolean;
  @Input() isHalftimeCorrectVal!: boolean;
  @Input() isScorerCorrectVal!: boolean;

  @Output() onClearScorer = new EventEmitter<void>();
  @Output() onModifierPronostic = new EventEmitter<void>();

  clearScorer() {
    this.onClearScorer.emit();
  }

  modifierPronostic() {
    this.onModifierPronostic.emit();
  }
}
