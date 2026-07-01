import { Component, OnInit, inject, Input, Output, EventEmitter, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { MatchesService } from '../../../../shared/services/content/matches.service';
import { PredictionsApiService } from '../../../../shared/services/api/predictions-api.service';
import { PointsCalculatorService, PointsBreakdown } from '../../../../shared/services/games/points-calculator.service';
import { TeamsService } from '../../../../shared/services/content/teams.service';
import { Matches } from '../../../../shared/contracts/matches.contract';
import { Pronostiques } from '../../../../shared/contracts/pronostiques.contract';
import { Teams } from '../../../../shared/contracts/teams.contract';
import { forkJoin } from 'rxjs';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';

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
  imports: [CommonModule, RouterModule, LoaderComponent, FormsModule, DatePicker, Select],
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
  private cdr = inject(ChangeDetectorRef);

  @Input() userId: string = '';
  @Output() close = new EventEmitter<void>();

  matches: Matches[] = [];
  predictions: Pronostiques[] = [];
  teams: Teams[] = [];
  teamFlagMap = new Map<string, string>();
  teamIsoMap = new Map<string, string>();
  loading = true;

  sortField: string = '';
  sortOrder: 'asc' | 'desc' = 'asc';

  activeFilterMenu: string | null = null;

  tempFilters: {
    match: string;
    date: Date | string | null;
    phase: string;
    score: string;
    prediction: string;
    points: string;
  } = {
    match: '',
    date: null,
    phase: '',
    score: '',
    prediction: '',
    points: ''
  };

  columnFilters: {
    match: string;
    date: Date | string | null;
    phase: string;
    score: string;
    prediction: string;
    points: string;
  } = {
    match: '',
    date: null,
    phase: '',
    score: '',
    prediction: '',
    points: ''
  };

  toggleFilterMenu(event: Event, field: string) {
    event.stopPropagation();
    if (this.activeFilterMenu === field) {
      this.activeFilterMenu = null;
    } else {
      this.activeFilterMenu = field;
      (this.tempFilters as any)[field] = (this.columnFilters as any)[field];
    }
    this.cdr.detectChanges();
  }

  applyFilter(field: string) {
    (this.columnFilters as any)[field] = (this.tempFilters as any)[field];
    this.activeFilterMenu = null;
    this.cdr.detectChanges();
  }

  clearFilter(field: string) {
    if (field === 'date') {
      this.tempFilters.date = null;
      this.columnFilters.date = null;
    } else {
      (this.tempFilters as any)[field] = '';
      (this.columnFilters as any)[field] = '';
    }
    this.activeFilterMenu = null;
    this.cdr.detectChanges();
  }

  isFilterActive(field: string): boolean {
    return !!(this.columnFilters as any)[field];
  }

  @HostListener('document:click', [])
  closeFilterMenus() {
    this.activeFilterMenu = null;
    this.cdr.detectChanges();
  }

  toggleSort(field: string) {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortOrder = 'asc';
    }
    this.cdr.detectChanges();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return 'unfold_more';
    return this.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  updateColumnFilter(event: Event, field: keyof typeof this.columnFilters) {
    const input = event.target as HTMLInputElement;
    this.columnFilters[field] = input.value;
    this.cdr.detectChanges();
  }

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
  
  phasesList = [
    { label: 'Toutes les phases', value: '' },
    { label: 'Group Stage', value: 'Group Stage' },
    { label: 'Round of 32', value: 'Round of 32' },
    { label: 'Round of 16', value: 'Round of 16' },
    { label: 'Quarter-finals', value: 'Quarter-finals' },
    { label: 'Semi-finals', value: 'Semi-finals' },
    { label: 'Final', value: 'Final' },
    { label: 'Third Place', value: 'Third Place' }
  ];

  isSummaryExpanded: boolean = true;
  isHistoryExpanded: boolean = true;

  ngOnInit() {
    if (!this.userId) {
      this.userId = this.route.snapshot.paramMap.get('id') || '';
    }
    if (!this.userId) {
      this.router.navigate(['/classement']);
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching scoresheet data', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredMatches() {
    let list = this.detailedMatches;

    // Apply global text filter
    if (this.filterText) {
      const lowerFilter = this.filterText.toLowerCase().trim();
      list = list.filter(item => {
        const teamA = (item.match.team_a || '').toLowerCase();
        const teamB = (item.match.team_b || '').toLowerCase();
        const phase = (item.match.phase || '').toLowerCase();
        return teamA.includes(lowerFilter) || teamB.includes(lowerFilter) || phase.includes(lowerFilter);
      });
    }

    // Apply column filters
    if (this.columnFilters.match) {
      const f = this.columnFilters.match.toLowerCase().trim();
      list = list.filter(item => {
        const teamA = (item.match.team_a || '').toLowerCase();
        const teamB = (item.match.team_b || '').toLowerCase();
        return teamA.includes(f) || teamB.includes(f);
      });
    }
    if (this.columnFilters.date) {
      const filterDate = this.columnFilters.date;
      list = list.filter(item => {
        const d = new Date(item.match.date);
        if (filterDate instanceof Date) {
          return d.getFullYear() === filterDate.getFullYear() &&
                 d.getMonth() === filterDate.getMonth() &&
                 d.getDate() === filterDate.getDate();
        } else {
          const f = String(filterDate).toLowerCase().trim();
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hrs = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          const dateStr = `${day}/${month}/${year} ${hrs}:${mins}`;
          return dateStr.toLowerCase().includes(f);
        }
      });
    }
    if (this.columnFilters.phase) {
      const f = this.columnFilters.phase.toLowerCase().trim();
      list = list.filter(item => (item.match.phase || '').toLowerCase().includes(f));
    }
    if (this.columnFilters.score) {
      const f = this.columnFilters.score.toLowerCase().trim();
      list = list.filter(item => {
        const scoreStr = `${item.match.fulltime_a} - ${item.match.fulltime_b}`;
        return scoreStr.includes(f);
      });
    }
    if (this.columnFilters.prediction) {
      const f = this.columnFilters.prediction.toLowerCase().trim();
      list = list.filter(item => {
        if (item.prediction.fulltime_a === null || item.prediction.fulltime_b === null) return f === '-';
        const predStr = `${item.prediction.fulltime_a} - ${item.prediction.fulltime_b}`;
        return predStr.includes(f);
      });
    }
    if (this.columnFilters.points) {
      const f = this.columnFilters.points.toLowerCase().trim();
      list = list.filter(item => {
        const pts = item.breakdown.isFraud ? '0' : String(item.breakdown.total);
        return pts.includes(f);
      });
    }

    // Apply sorting
    if (this.sortField) {
      const order = this.sortOrder === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (this.sortField === 'match') {
          valA = (a.match.team_a || '') + ' ' + (a.match.team_b || '');
          valB = (b.match.team_a || '') + ' ' + (b.match.team_b || '');
        } else if (this.sortField === 'date') {
          valA = new Date(a.match.date).getTime();
          valB = new Date(b.match.date).getTime();
        } else if (this.sortField === 'phase') {
          valA = a.match.phase || '';
          valB = b.match.phase || '';
        } else if (this.sortField === 'score') {
          valA = (a.match.fulltime_a ?? 0) * 100 + (a.match.fulltime_b ?? 0);
          valB = (b.match.fulltime_a ?? 0) * 100 + (b.match.fulltime_b ?? 0);
        } else if (this.sortField === 'prediction') {
          valA = (a.prediction.fulltime_a ?? -1) * 100 + (a.prediction.fulltime_b ?? -1);
          valB = (b.prediction.fulltime_a ?? -1) * 100 + (b.prediction.fulltime_b ?? -1);
        } else if (this.sortField === 'points') {
          valA = a.breakdown.isFraud ? 0 : a.breakdown.total;
          valB = b.breakdown.isFraud ? 0 : b.breakdown.total;
        }

        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    }

    return list;
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
    if (this.close.observed) {
      this.close.emit();
    } else {
      this.router.navigate(['/classement']);
    }
  }
}
