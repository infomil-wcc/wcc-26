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

  /** Match mode for text filters: 'contains' | 'startsWith' | 'endsWith' */
  matchModes: Record<string, 'contains' | 'startsWith' | 'endsWith'> = {
    match: 'contains',
    score: 'contains',
    prediction: 'contains'
  };
  tempMatchModes: Record<string, 'contains' | 'startsWith' | 'endsWith'> = {
    match: 'contains',
    score: 'contains',
    prediction: 'contains'
  };

  matchModeOptions = [
    { label: 'Contient', value: 'contains' },
    { label: 'Commence par', value: 'startsWith' },
    { label: 'Finit par', value: 'endsWith' }
  ];

  tempFilters: {
    match: string;
    dateFrom: Date | null;
    dateTo: Date | null;
    phase: string;
    score: string;
    prediction: string;
    pointsMin: string;
    pointsMax: string;
  } = {
    match: '',
    dateFrom: null,
    dateTo: null,
    phase: '',
    score: '',
    prediction: '',
    pointsMin: '',
    pointsMax: ''
  };

  columnFilters: {
    match: string;
    dateFrom: Date | null;
    dateTo: Date | null;
    phase: string;
    score: string;
    prediction: string;
    pointsMin: string;
    pointsMax: string;
  } = {
    match: '',
    dateFrom: null,
    dateTo: null,
    phase: '',
    score: '',
    prediction: '',
    pointsMin: '',
    pointsMax: ''
  };

  toggleFilterMenu(event: Event, field: string) {
    event.stopPropagation();
    if (this.activeFilterMenu === field) {
      this.activeFilterMenu = null;
    } else {
      this.activeFilterMenu = field;
      // Sync temp filter values from active column filters
      if (field === 'date') {
        this.tempFilters.dateFrom = this.columnFilters.dateFrom;
        this.tempFilters.dateTo = this.columnFilters.dateTo;
      } else if (field === 'points') {
        this.tempFilters.pointsMin = this.columnFilters.pointsMin;
        this.tempFilters.pointsMax = this.columnFilters.pointsMax;
      } else {
        (this.tempFilters as any)[field] = (this.columnFilters as any)[field];
      }
      if (this.matchModes[field]) {
        this.tempMatchModes[field] = this.matchModes[field];
      }
    }
    this.cdr.detectChanges();
  }

  applyFilter(field: string) {
    if (field === 'date') {
      this.columnFilters.dateFrom = this.tempFilters.dateFrom;
      this.columnFilters.dateTo = this.tempFilters.dateTo;
    } else if (field === 'points') {
      this.columnFilters.pointsMin = this.tempFilters.pointsMin;
      this.columnFilters.pointsMax = this.tempFilters.pointsMax;
    } else {
      (this.columnFilters as any)[field] = (this.tempFilters as any)[field];
      if (this.tempMatchModes[field]) {
        this.matchModes[field] = this.tempMatchModes[field];
      }
    }
    this.activeFilterMenu = null;
    this.cdr.detectChanges();
  }

  clearFilter(field: string) {
    if (field === 'date') {
      this.tempFilters.dateFrom = null;
      this.tempFilters.dateTo = null;
      this.columnFilters.dateFrom = null;
      this.columnFilters.dateTo = null;
    } else if (field === 'points') {
      this.tempFilters.pointsMin = '';
      this.tempFilters.pointsMax = '';
      this.columnFilters.pointsMin = '';
      this.columnFilters.pointsMax = '';
    } else {
      (this.tempFilters as any)[field] = '';
      (this.columnFilters as any)[field] = '';
      if (this.tempMatchModes[field]) {
        this.tempMatchModes[field] = 'contains';
        this.matchModes[field] = 'contains';
      }
    }
    this.activeFilterMenu = null;
    this.cdr.detectChanges();
  }

  isFilterActive(field: string): boolean {
    if (field === 'date') return !!(this.columnFilters.dateFrom || this.columnFilters.dateTo);
    if (field === 'points') return !!(this.columnFilters.pointsMin || this.columnFilters.pointsMax);
    return !!(this.columnFilters as any)[field];
  }

  /** Apply a text match based on configured match mode */
  private applyTextMatch(value: string, filter: string, mode: 'contains' | 'startsWith' | 'endsWith'): boolean {
    const v = value.toLowerCase();
    const f = filter.toLowerCase().trim();
    if (!f) return true;
    switch (mode) {
      case 'startsWith': return v.startsWith(f);
      case 'endsWith':   return v.endsWith(f);
      default:           return v.includes(f);
    }
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
      const mode = this.matchModes['match'] || 'contains';
      list = list.filter(item => {
        const teamA = item.match.team_a || '';
        const teamB = item.match.team_b || '';
        return this.applyTextMatch(teamA, this.columnFilters.match, mode) ||
               this.applyTextMatch(teamB, this.columnFilters.match, mode);
      });
    }
    if (this.columnFilters.dateFrom || this.columnFilters.dateTo) {
      list = list.filter(item => {
        const d = new Date(item.match.date);
        const dTime = d.getTime();
        const from = this.columnFilters.dateFrom ? new Date(this.columnFilters.dateFrom).setHours(0,0,0,0) : null;
        const to   = this.columnFilters.dateTo   ? new Date(this.columnFilters.dateTo).setHours(23,59,59,999) : null;
        if (from && dTime < from) return false;
        if (to   && dTime > to)   return false;
        return true;
      });
    }
    if (this.columnFilters.phase) {
      list = list.filter(item => (item.match.phase || '') === this.columnFilters.phase);
    }
    if (this.columnFilters.score) {
      const mode = this.matchModes['score'] || 'contains';
      list = list.filter(item => {
        const scoreStr = `${item.match.fulltime_a} - ${item.match.fulltime_b}`;
        return this.applyTextMatch(scoreStr, this.columnFilters.score, mode);
      });
    }
    if (this.columnFilters.prediction) {
      const mode = this.matchModes['prediction'] || 'contains';
      list = list.filter(item => {
        if (item.prediction.fulltime_a === null || item.prediction.fulltime_b === null) {
          return this.applyTextMatch('-', this.columnFilters.prediction, mode);
        }
        const predStr = `${item.prediction.fulltime_a} - ${item.prediction.fulltime_b}`;
        return this.applyTextMatch(predStr, this.columnFilters.prediction, mode);
      });
    }
    if (this.columnFilters.pointsMin || this.columnFilters.pointsMax) {
      const minVal = this.columnFilters.pointsMin !== '' ? Number(this.columnFilters.pointsMin) : null;
      const maxVal = this.columnFilters.pointsMax !== '' ? Number(this.columnFilters.pointsMax) : null;
      list = list.filter(item => {
        const pts = item.breakdown.isFraud ? 0 : item.breakdown.total;
        if (minVal !== null && pts < minVal) return false;
        if (maxVal !== null && pts > maxVal) return false;
        return true;
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

  /** Parse scorers JSON from a match into a normalized array of scorer events */
  parseMatchScorers(match: any): any[] {
    if (!match || !match.scorers) return [];
    const val = match.scorers;
    let list: any[] = [];
    if (Array.isArray(val)) {
      list = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try { list = JSON.parse(trimmed); } catch (e) { list = []; }
      }
    }
    return list.map(e => {
      let name = e.player?.name || e.scorer?.name || e.name || 'Unknown';
      let elapsed = e.time?.elapsed ?? 0;
      let extra = e.time?.extra ?? null;
      let detail = e.detail || 'Normal Goal';
      const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
      const m = typeof name === 'string' ? name.trim().match(regex) : null;
      if (m) {
        name = m[1].trim();
        elapsed = parseInt(m[2], 10);
        extra = m[3] ? parseInt(m[3], 10) : null;
        if (m[4]) {
          const dl = m[4].toLowerCase();
          if (dl.includes('og') || dl.includes('csc')) detail = 'Own Goal';
          else if (dl.includes('p') || dl.includes('pen')) detail = 'Penalty';
        }
      }
      return { ...e, player: { name }, time: { elapsed, extra }, detail };
    });
  }

  /** Get grouped scorers for a given team from a match */
  getMatchScorersGrouped(match: any, teamName: string): { name: string; times: string }[] {
    if (!match || !match.scorers || !teamName) return [];
    const events = this.parseMatchScorers(match);
    if (events.length === 0) return [];
    const teamEvents = events.filter((e: any) => {
      const eventTeam = e.team?.name || e.team;
      return eventTeam && typeof eventTeam === 'string' &&
        eventTeam.trim().toLowerCase() === teamName.trim().toLowerCase();
    });
    const groups: { [name: string]: string[] } = {};
    for (const e of teamEvents) {
      const name = e.player?.name || 'Unknown';
      let timeStr = `${e.time.elapsed}`;
      if (e.time.extra) timeStr += `+${e.time.extra}`;
      timeStr += "'";
      if (e.detail === 'Penalty') timeStr += ' [PEN]';
      else if (e.detail === 'Own Goal') timeStr += ' [OG]';
      if (!groups[name]) groups[name] = [];
      groups[name].push(timeStr);
    }
    return Object.keys(groups).map(name => ({ name, times: `(${groups[name].join(', ')})` }));
  }

  /** Returns true if the match is in the Group Stage */
  isGroupStage(item: any): boolean {
    return item?.match?.phase === 'Group Stage';
  }

  /** Returns the winner team name based on the prediction's winner_draw field */
  getPronosticWinnerTeamName(item: any): string {
    const wd = item?.prediction?.winner_draw;
    if (!wd || wd === 'draw') return 'Match Nul';
    if (wd === 'team_a') return item?.match?.team_a || 'Équipe A';
    if (wd === 'team_b') return item?.match?.team_b || 'Équipe B';
    return wd;
  }

  /** Returns the actual winner team name from match result */
  getActualWinnerTeamName(item: any): string {
    const wd = item?.match?.winner_draw;
    if (!wd || wd === 'draw') return 'Match Nul';
    if (wd === 'team_a') return item?.match?.team_a || 'Équipe A';
    if (wd === 'team_b') return item?.match?.team_b || 'Équipe B';
    return wd;
  }

  /** Returns true if the match has penalty shootout info */
  hasPenalty(item: any): boolean {
    return item?.match?.penalty_a !== null && item?.match?.penalty_b !== null;
  }

  /** Check if match has scorer events (JSON format) */
  hasScorersJson(match: any): boolean {
    return this.parseMatchScorers(match).length > 0;
  }
}
