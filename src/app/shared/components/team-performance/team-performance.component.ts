import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatchesService } from '../../../core/services/content/matches.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

interface FormResult {
  result: 'W' | 'D' | 'L' | '';
}

const FORM_SLOTS = 5;

@Component({
  selector: 'teamperformance',
  templateUrl: './team-performance.component.html',
  styleUrl: './team-performance.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [AsyncPipe]
})
export class TeamPerformanceComponent implements OnInit {

  @Input() teamName!: string;

  private matchesService = inject(MatchesService);

  protected $form!: Observable<FormResult[]>;

  ngOnInit(): void {
    this.$form = this.matchesService.getAllMatches().pipe(
      map(matches => this.computeForm(matches))
    );
  }

  private computeForm(matches: any[]): FormResult[] {
    // Only played matches involving this team, sorted chronologically
    const played = matches
      .filter(m =>
        m.fulltime_a !== null && m.fulltime_b !== null &&
        (m.team_a === this.teamName || m.team_b === this.teamName)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build W/D/L from scores
    const results: ('W' | 'D' | 'L')[] = played.map(m => {
      const isTeamA = m.team_a === this.teamName;
      const goalsFor = isTeamA ? m.fulltime_a : m.fulltime_b;
      const goalsAgainst = isTeamA ? m.fulltime_b : m.fulltime_a;

      if (goalsFor > goalsAgainst) return 'W';
      if (goalsFor < goalsAgainst) return 'L';
      return 'D';
    });

    // Take last FORM_SLOTS results and pad with empty slots
    const last = results.slice(-FORM_SLOTS);
    const empty = FORM_SLOTS - last.length;

    return [
      ...last.map(r => ({ result: r } as FormResult)),
      ...Array(empty).fill({ result: '' } as FormResult)
    ];
  }
}
