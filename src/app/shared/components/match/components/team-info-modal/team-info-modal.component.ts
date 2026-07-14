import { Component, EventEmitter, Input, Output, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TeamPerformanceComponent } from '../../../team-performance/team-performance.component';
import { MatchFacade } from '@core/facades/match.facade';

@Component({
  selector: 'app-team-info-modal',
  standalone: true,
  imports: [CommonModule, DatePipe, TeamPerformanceComponent],
  templateUrl: './team-info-modal.component.html',
  styleUrl: './team-info-modal.component.scss'
})
export class TeamInfoModalComponent implements OnInit, OnDestroy {
  @Input() showTeamInfoModal!: boolean;
  @Input() selectedTeamName!: string;
  @Input() loadingTeamInfo!: boolean;
  @Input() teamPastMatches!: any[];
  @Input() flagsLookup!: { [key: string]: string };

  @Output() onCloseModal = new EventEmitter<void>();

  facade = inject(MatchFacade);

  ngOnInit() {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  get groupedMatches() {
    if (!this.teamPastMatches) return [];

    // Group matches by phase
    const groups = this.teamPastMatches.reduce((acc, match) => {
      const phase = match.phase || 'AUTRE';
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(match);
      return acc;
    }, {} as Record<string, any[]>);

    // Convert to array
    return Object.keys(groups).map(key => ({
      phase: key,
      matches: groups[key]
    }));
  }

  getTeamFlagUrl(teamName: string): string {
    return (this.flagsLookup && this.flagsLookup[teamName]) ? this.flagsLookup[teamName] : 'assets/flags/unknown.png';
  }

  closeModal() {
    this.onCloseModal.emit();
  }

  isScorersJson(match: any): boolean {
    return this.facade.isMatchScorersJson(match);
  }

  getTeamAScorers(match: any): any[] {
    return this.facade.getMatchScorersGrouped(match, match.team_a);
  }

  getTeamBScorers(match: any): any[] {
    return this.facade.getMatchScorersGrouped(match, match.team_b);
  }

  getMatchOutcome(match: any): { label: string, bgClass: string, textClass: string } {
    let teamGoals = 0;
    let oppGoals = 0;

    if (match.team_a === this.selectedTeamName) {
      teamGoals = match.fulltime_a ?? 0;
      oppGoals = match.fulltime_b ?? 0;
    } else {
      teamGoals = match.fulltime_b ?? 0;
      oppGoals = match.fulltime_a ?? 0;
    }

    if (teamGoals > oppGoals) {
      return { label: 'VICTOIRE', bgClass: 'bg-[#064e3b]', textClass: 'text-[#34d399]' };
    } else if (teamGoals < oppGoals) {
      return { label: 'DÉFAITE', bgClass: 'bg-[#7f1d1d]', textClass: 'text-[#f87171]' };
    } else {
      if (match.penalty_a !== null && match.penalty_b !== null) {
        const teamPen = match.team_a === this.selectedTeamName ? match.penalty_a : match.penalty_b;
        const oppPen = match.team_a === this.selectedTeamName ? match.penalty_b : match.penalty_a;
        if (teamPen > oppPen) return { label: 'VICTOIRE (TAB)', bgClass: 'bg-[#064e3b]', textClass: 'text-[#34d399]' };
        if (teamPen < oppPen) return { label: 'DÉFAITE (TAB)', bgClass: 'bg-[#7f1d1d]', textClass: 'text-[#f87171]' };
      }
      return { label: 'NUL', bgClass: 'bg-[#334155]', textClass: 'text-[#cbd5e1]' };
    }
  }
}
