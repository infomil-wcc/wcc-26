import { Injectable } from '@angular/core';
import { Matches } from '../../../shared/contracts/matches.contract';
import Fuse from 'fuse.js';

@Injectable({
  providedIn: 'root'
})
export class MatchScorersService {
  constructor() { }

  parseScorers(scorersVal: any): any[] {
    if (!scorersVal) return [];
    let list: any[] = [];
    if (Array.isArray(scorersVal)) {
      list = scorersVal;
    } else if (typeof scorersVal === 'string') {
      const trimmed = scorersVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          list = JSON.parse(trimmed);
        } catch (e) {
          list = [];
        }
      }
    }

    return list.map(e => {
      let name = e.player?.name || e.scorer?.name || e.name || 'Unknown';
      let elapsed = e.time?.elapsed ?? 0;
      let extra = e.time?.extra ?? null;
      let detail = e.detail || 'Normal Goal';

      const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
      const match = typeof name === 'string' ? name.trim().match(regex) : null;
      if (match) {
        name = match[1].trim();
        elapsed = parseInt(match[2], 10);
        extra = match[3] ? parseInt(match[3], 10) : null;
        if (match[4]) {
          const detailLower = match[4].toLowerCase();
          if (detailLower.includes('og') || detailLower.includes('csc')) {
            detail = 'Own Goal';
          } else if (detailLower.includes('p') || detailLower.includes('pen')) {
            detail = 'Penalty';
          }
        }
      }
      return {
        ...e,
        player: { name },
        time: { elapsed, extra },
        detail
      };
    });
  }

  isMatchScorersJson(m: Matches): boolean {
    if (!m || !m.scorers) return false;
    const events = this.parseScorers(m.scorers);
    return events.length > 0;
  }

  getMatchScorersGrouped(m: Matches, teamName: string): any[] {
    if (!m || !m.scorers) return [];
    const events = this.parseScorers(m.scorers);
    if (events.length === 0) return [];

    const teamEvents = events.filter(e => {
      const eventTeam = e.team?.name || e.team;
      return eventTeam && typeof eventTeam === 'string' && eventTeam.trim().toLowerCase() ===
        teamName.trim().toLowerCase();
    });

    const groups: { [name: string]: { times: string[], types: string[] } } = {};
    for (const e of teamEvents) {
      const name = e.player?.name || 'Unknown';
      let timeStr = `${e.time.elapsed}`;
      if (e.time.extra) {
        timeStr += `+${e.time.extra}`;
      }
      timeStr += "'";
      if (e.detail === 'Penalty') {
        timeStr += ' <span class="text-[9px] font-black text-amber-500 ml-0.5">PEN</span>';
      } else if (e.detail === 'Own Goal') {
        timeStr += ' <span class="text-[9px] font-black text-red-500 ml-0.5">CSC</span>';
      }

      if (!groups[name]) {
        groups[name] = { times: [], types: [] };
      }
      groups[name].times.push(timeStr);
      groups[name].types.push(e.detail);
    }

    return Object.keys(groups).map(name => {
      let icon = 'sports_soccer';
      let iconColor = 'text-slate-400';
      
      if (groups[name].types.includes('Own Goal')) {
        icon = 'cancel';
        iconColor = 'text-red-500';
      } else if (groups[name].types.includes('Penalty')) {
        icon = 'sports_soccer';
        iconColor = 'text-amber-500';
      }

      return {
        name,
        times: `(${groups[name].times.join(', ')})`,
        icon,
        iconColor
      };
    });
  }

  isScorerCorrect(predictedScorer: string, match: Matches): boolean {
    if (!predictedScorer || predictedScorer === '-' || !match || !match.scorers) {
      return false;
    }

    let scorersList: string[] = [];
    if (this.isMatchScorersJson(match)) {
      scorersList = this.parseScorers(match.scorers).map(e => e.player?.name).filter(Boolean);
    } else {
      const scorersVal = match.scorers;
      if (typeof scorersVal === 'string') {
        scorersList = scorersVal.split(',').map(name => {
          let trimmed = name.trim();
          const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
          const matchRegex = trimmed.match(regex);
          return matchRegex ? matchRegex[1].trim() : trimmed;
        });
      }
    }

    const normalizeName = (name: string) => {
      if (!name || typeof name !== 'string') return '';
      return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(' ')
        .trim();
    };

    const normalizedPredScorer = normalizeName(predictedScorer);
    const normalizedScorersList = scorersList.map(name => normalizeName(name));

    const fuse = new Fuse(normalizedScorersList, {
      includeScore: true,
      threshold: 0.4
    });

    const results = fuse.search(normalizedPredScorer);
    return results.length > 0;
  }
}
