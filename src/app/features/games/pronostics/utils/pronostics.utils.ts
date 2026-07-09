import { Matches } from '../../../../shared/contracts/matches.contract';

export const PHASE_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'Group Stage', label: 'Phase de groupes', icon: 'groups', color: '#3b5bdb' },
  { key: 'Round of 32', label: 'Seizièmes de finale', icon: 'filter_none', color: '#7048e8' },
  { key: 'Round of 16', label: 'Huitièmes de finale', icon: 'filter_8', color: '#9c36b5' },
  { key: 'Quarter-finals', label: 'Quarts de finale', icon: 'emoji_events', color: '#d6336c' },
  { key: 'Semi-finals', label: 'Demi-finales', icon: 'military_tech', color: '#f76707' },
  { key: 'Final', label: 'Finale', icon: 'workspace_premium', color: '#f59f00' },
];

export function groupMatchesByDate(matches: Matches[]): { [key: string]: Matches[] } {
  return matches.reduce((groups, match) => {
    const dateKey = match.date.split(' ')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(match);
    return groups;
  }, {} as { [key: string]: Matches[] });
}

export function isLive(match: Matches, currentMuTimeStr: string): boolean {
  const now = new Date(currentMuTimeStr.slice(0, -6));
  const matchDate = new Date(match.date);
  const isFinishedStatus = match.current_status?.toLowerCase() === 'finished' || match.played === true;
  const timeDiffMs = now.getTime() - matchDate.getTime();
  const timeDiffMins = timeDiffMs / (1000 * 60);
  return timeDiffMins >= 0 && timeDiffMins < 150 && !isFinishedStatus;
}

export function getDates(groupedMatches: { [key: string]: Matches[] }): string[] {
  return Object.keys(groupedMatches).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

export function getPlayedDates(groupedMatches: { [key: string]: Matches[] }): string[] {
  return Object.keys(groupedMatches).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}

export function compareDates(date1: string, date2: string): boolean {
  return date1.slice(0, 10) > date2;
}

export function getSortedPlayedMatchesForDate(matches: Matches[]): Matches[] {
  return (matches || [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getUpcomingPhases(groupedMatches: { [key: string]: Matches[] }): typeof PHASE_CONFIG {
  const allUpcoming = Object.values(groupedMatches).flat();
  const presentKeys = new Set(allUpcoming.map(m => m.phase));
  return PHASE_CONFIG.filter(p => presentKeys.has(p.key));
}

export function getMatchesByPhaseAndDate(
  groupedMatches: { [key: string]: Matches[] },
  phaseKey: string
): { date: string; matches: Matches[] }[] {
  const byDate: { [date: string]: Matches[] } = {};
  const dates = getDates(groupedMatches);
  for (const date of dates) {
    const filtered = (groupedMatches[date] || [])
      .filter(m => m.phase === phaseKey);
    if (filtered.length > 0) {
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      byDate[date] = filtered;
    }
  }
  return Object.entries(byDate)
    .map(([date, matches]) => ({ date, matches }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
