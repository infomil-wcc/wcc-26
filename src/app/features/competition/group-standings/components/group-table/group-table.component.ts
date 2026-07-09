import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { TeamsService } from '../../../../../core/services/content/teams.service';
import { MatchesService } from '../../../../../core/services/content/matches.service';
import { Teams } from '../../../../../shared/contracts/teams.contract';
import { Matches } from '../../../../../shared/contracts/matches.contract';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// FIFA World Cup 2026: 12 groups, top 2 + best 8 third-placed qualify (32 total)
const GROUPS_COUNT = 12;
const BEST_THIRDS_QUALIFY = 8;

export type QualificationType = 'auto' | 'best-third' | null;

export interface GroupStanding {
  position: number;
  team: Teams;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: string[];
  qualificationType: QualificationType;
}

export interface GroupData {
  name: string;
  standings: GroupStanding[];
}

@Component({
  selector: 'app-group-table',
  templateUrl: './group-table.component.html',
  styleUrl: './group-table.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, AsyncPipe]
})
export class GroupTableComponent implements OnInit {
  private teamsService = inject(TeamsService);
  private matchesService = inject(MatchesService);

  $groups!: Observable<GroupData[]>;

  ngOnInit(): void {
    this.$groups = combineLatest([
      this.teamsService.getAllTeams(),
      this.matchesService.getAllMatches()
    ]).pipe(
      map(([teams, matches]) => this.buildGroupStandings(teams, matches))
    );
  }

  private buildGroupStandings(teams: Teams[], matches: Matches[]): GroupData[] {
    if (!teams || !Array.isArray(teams)) {
      return [];
    }
    if (!matches || !Array.isArray(matches)) {
      matches = [];
    }
    // Only Group Stage played matches
    const groupMatches = matches.filter(m => m.phase === 'Group Stage');
    const playedMatches = groupMatches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null);

    // Per-team computed stats (100% from match results — no reliance on DB aggregate fields)
    interface TeamStats {
      mp: number; w: number; d: number; l: number;
      gf: number; ga: number; pts: number;
      formResults: { date: string; result: string }[];
    }

    const teamStats: { [teamName: string]: TeamStats } = {};

    const ensureTeam = (name: string) => {
      if (!teamStats[name]) {
        teamStats[name] = { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, formResults: [] };
      }
    };

    // Sort played matches by date ascending so form is chronological
    const sortedPlayed = [...playedMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const match of sortedPlayed) {
      ensureTeam(match.team_a);
      ensureTeam(match.team_b);

      const goalsA = match.fulltime_a!;
      const goalsB = match.fulltime_b!;
      const sA = teamStats[match.team_a];
      const sB = teamStats[match.team_b];

      sA.mp += 1; sB.mp += 1;
      sA.gf += goalsA; sA.ga += goalsB;
      sB.gf += goalsB; sB.ga += goalsA;

      if (goalsA > goalsB) {
        sA.w += 1; sA.pts += 3; sB.l += 1;
        sA.formResults.push({ date: match.date, result: 'W' });
        sB.formResults.push({ date: match.date, result: 'L' });
      } else if (goalsA < goalsB) {
        sB.w += 1; sB.pts += 3; sA.l += 1;
        sA.formResults.push({ date: match.date, result: 'L' });
        sB.formResults.push({ date: match.date, result: 'W' });
      } else {
        sA.d += 1; sA.pts += 1; sB.d += 1; sB.pts += 1;
        sA.formResults.push({ date: match.date, result: 'D' });
        sB.formResults.push({ date: match.date, result: 'D' });
      }
    }

    // Group teams by their group field
    const groupMap: { [groupName: string]: Teams[] } = {};
    for (const team of teams) {
      if (!team.group) continue;
      if (!groupMap[team.group]) groupMap[team.group] = [];
      groupMap[team.group].push(team);
    }

    const FORM_SLOTS = 5;
    const groupNames = Object.keys(groupMap).sort();

    // ─── Build initial standings per group (no qualification markers yet) ─────
    const allGroups: GroupData[] = groupNames.map(groupName => {
      const groupTeams = groupMap[groupName];

      const standings: GroupStanding[] = groupTeams.map(team => {
        const stats = teamStats[team.name] || { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, formResults: [] };
        const gd = stats.gf - stats.ga;

        // Form: colored dots only for matches played, empty circles for the rest
        const played = stats.formResults.slice(-FORM_SLOTS);
        const form: string[] = [
          ...played.map(r => r.result),
          ...Array(FORM_SLOTS - played.length).fill('')
        ];

        return {
          position: 0, team,
          mp: stats.mp, w: stats.w, d: stats.d, l: stats.l,
          gf: stats.gf, ga: stats.ga, gd, pts: stats.pts,
          form, qualificationType: null
        };
      });

      // Sort: pts → GD → GF → alphabetical
      standings.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.name.localeCompare(b.team.name);
      });

      standings.forEach((s, i) => { s.position = i + 1; });

      return { name: groupName, standings };
    });

    // ─── FIFA WC 2026: Mark auto-qualifiers (1st & 2nd in each group) ────────
    for (const group of allGroups) {
      for (const standing of group.standings) {
        if (standing.position <= 2) {
          standing.qualificationType = 'auto';
        }
      }
    }

    // ─── FIFA WC 2026: Best 8 third-placed teams qualify ─────────────────────
    // Collect all 3rd-placed teams across all groups
    const thirdPlaced = allGroups
      .map(g => g.standings.find(s => s.position === 3))
      .filter((s): s is GroupStanding => s !== undefined);

    // Rank all 3rd-placed: pts → GD → GF → alphabetical
    thirdPlaced.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.name.localeCompare(b.team.name);
    });

    // Top BEST_THIRDS_QUALIFY third-placed teams qualify
    // Only mark them if the group stage has enough matches to be meaningful
    // (if total groups with 3rd-placed teams >= GROUPS_COUNT, all 3rds can be ranked)
    const qualifyingThirds = new Set(
      thirdPlaced.slice(0, BEST_THIRDS_QUALIFY).map(s => s.team.name)
    );

    for (const group of allGroups) {
      for (const standing of group.standings) {
        if (standing.position === 3 && qualifyingThirds.has(standing.team.name)) {
          standing.qualificationType = 'best-third';
        }
      }
    }

    return allGroups;
  }

  getFormClass(result: string): string {
    switch (result?.toUpperCase()) {
      case 'W': return 'form-win';
      case 'D': return 'form-draw';
      case 'L': return 'form-loss';
      default: return 'form-empty';
    }
  }

  getFormIcon(result: string): string {
    switch (result?.toUpperCase()) {
      case 'W': return 'check';
      case 'D': return 'remove';
      case 'L': return 'close';
      default: return '';
    }
  }
}
