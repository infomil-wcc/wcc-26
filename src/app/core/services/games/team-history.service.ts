import { Injectable } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';

export const PHASE_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'Group Stage', label: 'Phase de groupes', icon: 'groups', color: '#3b5bdb' },
  { key: 'Round of 32', label: 'Seizièmes de finale', icon: 'filter_none', color: '#7048e8' },
  { key: 'Round of 16', label: 'Huitièmes de finale', icon: 'filter_8', color: '#9c36b5' },
  { key: 'Quarter-finals', label: 'Quarts de finale', icon: 'emoji_events', color: '#d6336c' },
  { key: 'Semi-finals', label: 'Demi-finales', icon: 'military_tech', color: '#f76707' },
  { key: 'Third Place', label: 'Troisième place', icon: 'looks_3', color: '#0ca678' },
  { key: 'Final', label: 'Finale', icon: 'workspace_premium', color: '#f59f00' }
];

@Injectable({
  providedIn: 'root'
})
export class TeamHistoryService {
  constructor() {}

  getPastMatchesPhases(teamPastMatches: Matches[]): typeof PHASE_CONFIG {
    const presentKeys = new Set(teamPastMatches.map(m => m.phase));
    return PHASE_CONFIG.filter(p => presentKeys.has(p.key));
  }

  getPastMatchesByPhase(teamPastMatches: Matches[], phaseKey: string): Matches[] {
    return teamPastMatches.filter(m => m.phase === phaseKey);
  }

  getMatchResultLabel(pastMatch: Matches, selectedTeamName: string): string {
    const isTeamA = pastMatch.team_a === selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return 'NUL';
    if (isTeamA) {
      return scoreA > scoreB ? 'VICTOIRE' : 'DÉFAITE';
    } else {
      return scoreB > scoreA ? 'VICTOIRE' : 'DÉFAITE';
    }
  }

  getMatchResultColor(pastMatch: Matches, selectedTeamName: string): string {
    const isTeamA = pastMatch.team_a === selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return '#718096'; 
    if (isTeamA) {
      return scoreA > scoreB ? '#48bb78' : '#e53e3e'; 
    } else {
      return scoreB > scoreA ? '#48bb78' : '#e53e3e'; 
    }
  }

  getMatchResultBgColor(pastMatch: Matches, selectedTeamName: string): string {
    const isTeamA = pastMatch.team_a === selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return 'rgba(113, 128, 150, 0.15)';
    if (isTeamA) {
      return scoreA > scoreB ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)';
    } else {
      return scoreB > scoreA ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)';
    }
  }

  getMatchResultTextColor(pastMatch: Matches, selectedTeamName: string): string {
    const isTeamA = pastMatch.team_a === selectedTeamName;
    const scoreA = Number(pastMatch.fulltime_a);
    const scoreB = Number(pastMatch.fulltime_b);
    if (scoreA === scoreB) return '#a0aec0';
    if (isTeamA) {
      return scoreA > scoreB ? '#48bb78' : '#f56565';
    } else {
      return scoreB > scoreA ? '#48bb78' : '#f56565';
    }
  }
}
