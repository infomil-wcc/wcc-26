import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-match-header',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './match-header.component.html',
  styleUrl: './match-header.component.scss'
})
export class MatchHeaderComponent {
  @Input() match!: any;
  @Input() closed!: boolean;
  @Input() pronostiqueDone!: boolean;
  @Input() isSavedInApi!: boolean;
  @Input() countdownText!: string;
}
