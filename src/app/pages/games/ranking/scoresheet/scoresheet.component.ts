import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatchesService } from '../../../../shared/services/content/matches.service';
import { PredictionsApiService } from '../../../../shared/services/api/predictions-api.service';
import { PointsCalculatorService, PointsBreakdown } from '../../../../shared/services/games/points-calculator.service';
import { TeamsService } from '../../../../shared/services/content/teams.service';
import { Matches } from '../../../../shared/contracts/matches.contract';
import { Pronostiques } from '../../../../shared/contracts/pronostiques.contract';
import { Teams } from '../../../../shared/contracts/teams.contract';
import { forkJoin } from 'rxjs';

interface PhaseSummary {
  winner: number;
  fulltime: number;
  halftime: number;
  scorer: number;
  consolation: number;
  total: number;
}

@Component({
  selector: 'app-scoresheet',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scoresheet.component.html',
  styleUrls: ['./scoresheet.component.scss']
})
export class ScoresheetComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private matchesService = inject(MatchesService);
  private predictionsApiService = inject(PredictionsApiService);
  private pointsCalculator = inject(PointsCalculatorService);
  private teamsService = inject(TeamsService);

  userId: string = '';
  matches: Matches[] = [];
  predictions: Pronostiques[] = [];
  teams: Teams[] = [];
  teamFlagMap = new Map<string, string>();
  teamIsoMap = new Map<string, string>();
  loading = true;

  // The 2D matrix structure
  summaryMatrix: Record<string, PhaseSummary> = {
    'Group Stage': this.emptySummary(),
    'Round of 32': this.emptySummary(),
    'Round of 16': this.emptySummary(),
    'Quarter-finals': this.emptySummary(),
    'Semi-finals': this.emptySummary(),
    'Final': this.emptySummary(), // Combining Third Place and Final
  };

  // List of processed matches for detailed view
  detailedMatches: any[] = [];
  filterText: string = '';
  
  isSummaryExpanded: boolean = true;
  isHistoryExpanded: boolean = true;

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.userId) {
      this.router.navigate(['/leaderboard']);
      return;
    }

    forkJoin({
      matches: this.matchesService.getAllMatches(),
      predictions: this.predictionsApiService.getPredictions(`?filter[user]=${this.userId}&limit=-1`),
      teams: this.teamsService.getAllTeams()
    }).subscribe({
      next: (res) => {
        this.matches = res.matches;
        this.predictions = res.predictions?.data || [];
        this.teams = res.teams || [];
        
        // Build map for fast lookup
        for (const t of this.teams) {
          if (t.name) {
            this.teamFlagMap.set(t.name.toLowerCase().trim(), t.flag_url || '');
            this.teamIsoMap.set(t.name.toLowerCase().trim(), t.iso || t.name.substring(0, 3).toUpperCase());
          }
        }
        
        this.calculateScoresheet();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching scoresheet data', err);
        this.loading = false;
      }
    });
  }

  get filteredMatches() {
    if (!this.filterText) return this.detailedMatches;
    const lowerFilter = this.filterText.toLowerCase().trim();
    return this.detailedMatches.filter(item => {
      const teamA = (item.match.team_a || '').toLowerCase();
      const teamB = (item.match.team_b || '').toLowerCase();
      const phase = (item.match.phase || '').toLowerCase();
      return teamA.includes(lowerFilter) || teamB.includes(lowerFilter) || phase.includes(lowerFilter);
    });
  }

  getTeamFlag(teamName: string): string | null {
    if (!teamName) return null;
    return this.teamFlagMap.get(teamName.toLowerCase().trim()) || null;
  }

  getTeamIso(teamName: string): string {
    if (!teamName) return '';
    return this.teamIsoMap.get(teamName.toLowerCase().trim()) || teamName;
  }

  getTeamNameShort(teamName: string | null): string {
    if (!teamName) return '';
    return teamName.substring(0, 3).toUpperCase();
  }

  emptySummary(): PhaseSummary {
    return { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0 };
  }

  calculateScoresheet() {
    const predMap = new Map<string, Pronostiques>();
    for (const p of this.predictions) {
      if (p.game_id) {
        predMap.set(String(p.game_id), p);
      }
    }

    // Process each match
    for (const match of this.matches) {
      const pred = predMap.get(String(match.id));
      if (!pred) continue; // no prediction for this match

      const breakdown = this.pointsCalculator.calculatePoints(match, pred);
      
      let phaseKey = match.phase || '';
      if (phaseKey === 'Third Place') phaseKey = 'Final'; // Group them together for the table

      if (this.summaryMatrix[phaseKey]) {
         this.summaryMatrix[phaseKey].winner += breakdown.winner;
         this.summaryMatrix[phaseKey].fulltime += breakdown.fulltime;
         this.summaryMatrix[phaseKey].halftime += breakdown.halftime;
         this.summaryMatrix[phaseKey].scorer += breakdown.scorer;
         this.summaryMatrix[phaseKey].consolation += breakdown.consolation;
         this.summaryMatrix[phaseKey].total += breakdown.total;
      }

      // Only show matches that have been played
      if (match.fulltime_a !== null && match.fulltime_b !== null) {
        this.detailedMatches.push({
          match,
          prediction: pred,
          breakdown,
          expanded: false // For UI toggle if needed
        });
      }
    }

    this.detailedMatches.sort((a, b) => new Date(a.match.date).getTime() - new Date(b.match.date).getTime());
  }

  getSummaryValue(phase: string, category: string): number {
    const summary = this.summaryMatrix[phase];
    if (!summary) return 0;
    return (summary as any)[category] || 0;
  }

  goBack() {
    this.router.navigate(['/classement']);
  }
}
