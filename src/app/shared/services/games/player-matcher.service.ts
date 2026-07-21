import { Injectable } from '@angular/core';
import Fuse from 'fuse.js';

@Injectable({
  providedIn: 'root'
})
export class PlayerMatcherService {
  
  matchSingle(apiRaw: string, dbPlayers: any[]): any {
    const apiClean = this.cleanName(this.extractName(apiRaw));
    const apiParts = this.splitName(apiClean);

    let best = null;
    let bestScore = 0;

    for (const player of dbPlayers) {
        const score = this.scorePlayer(apiParts, player);

        if (score > bestScore) {
            bestScore = score;
            best = player;
        }
    }

    if (bestScore >= 0.6) {
        return {
            apiName: apiRaw,
            matchedPlayer: best,
            confidence: bestScore
        };
    }

    // Try Fuse as fallback
    const fuseResult = this.fuseMatch(apiClean, dbPlayers);

    if (fuseResult && fuseResult.score > bestScore) {
        best = fuseResult.player;
        bestScore = fuseResult.score;
    }

    return {
        apiName: apiRaw,
        matchedPlayer: bestScore >= 0.35 ? best : null,
        confidence: bestScore
    };
  }

  scorePlayer(apiParts: string[], player: any): number {
      const variants = this.buildVariants(player);

      let best = 0;

      for (const variant of variants) {
          const dbParts = this.splitName(variant);
          const score = this.scoreParts(apiParts, dbParts);

          if (score > best) best = score;
      }

      return best;
  }

  scoreParts(api: string[], db: string[]): number {
      let score = 0;

      const apiFirst = api[0];
      const apiLast = api[api.length - 1];

      const dbFirst = db[0];
      const dbLast = db[db.length - 1];

      if (api.join(' ') === db.join(' ')) return 1;

      if (apiLast && dbLast && apiLast === dbLast) score += 0.6;
      if (apiFirst && dbFirst && apiFirst === dbFirst) score += 0.3;
      if (apiFirst === dbLast && apiLast === dbFirst) score += 0.85;
      if (this.isInitialMatch(apiFirst, dbFirst)) score += 0.25;

      score += this.tokenSimilarity(api.join(' '), db.join(' ')) * 0.4;

      return Math.min(score, 1);
  }

  buildVariants(player: any): string[] {
      const base = this.cleanName(player.player_name || player.name || '');
      const parts = this.splitName(base);

      const set = new Set<string>();
      set.add(base);

      if (parts.length > 1) {
          set.add([...parts].reverse().join(' '));
          set.add(`${parts[0]} ${parts[1][0]}`);
      }

      for (const a of player.aliases || []) {
          set.add(this.cleanName(a));
      }

      return Array.from(set);
  }

  cleanName(name: string): string {
      if (!name) return '';
      return name.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
  }

  extractName(raw: string): string {
      if (!raw) return '';
      let n = raw.replace(/\b(og|pen)\b/gi, '').replace(/[0-9'\s]+$/, '').trim();
      if (n.toUpperCase().startsWith('NOT FOUND:')) {
          n = n.substring(10).trim();
      }
      return n;
  }

  splitName(name: string): string[] {
      return name.split(' ').filter(p => p.length > 0);
  }

  isInitialMatch(p1: string, p2: string): boolean {
      if (!p1 || !p2) return false;
      return (p1.length === 1 && p2.startsWith(p1)) || (p2.length === 1 && p1.startsWith(p2));
  }

  tokenSimilarity(s1: string, s2: string): number {
      const t1 = this.splitName(s1);
      const t2 = this.splitName(s2);

      let matches = 0;
      for (const tok of t1) {
          if (t2.includes(tok)) matches++;
      }

      const totalTokens = Math.max(t1.length, t2.length);
      return totalTokens === 0 ? 0 : matches / totalTokens;
  }

  fuseMatch(query: string, players: any[]): any {
      const fuse = new Fuse(players, {
          keys: ['player_name', 'name', 'aliases'],
          includeScore: true,
          threshold: 0.4
      });

      const results = fuse.search(query);
      if (results.length > 0 && results[0].score !== undefined) {
          return {
              player: results[0].item,
              score: 1 - results[0].score // Fuse score is distance (0 = perfect), so 1 - score is confidence
          };
      }
      return null;
  }

  formatPlayerName(name: string): string {
    if (!name || name === '-') return name;
    
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      // If the first word is completely uppercase and has letters
      const firstWord = parts[0];
      if (firstWord === firstWord.toUpperCase() && firstWord.match(/[A-Z\u00C0-\u00DC]/)) {
        let i = 0;
        const lastNames = [];
        while (i < parts.length && parts[i] === parts[i].toUpperCase() && parts[i].match(/[A-Z\u00C0-\u00DC]/)) {
          lastNames.push(parts[i]);
          i++;
        }
        
        if (i < parts.length && lastNames.length > 0) {
          const firstNames = parts.slice(i);
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          const formattedLastName = lastNames.map(capitalize).join(' ');
          const formattedFirstName = firstNames.map(capitalize).join(' ');
          
          return `${formattedFirstName} ${formattedLastName}`;
        }
      }
    }
    
    const capitalize = (s: string) => s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    return parts.map(capitalize).join(' ');
  }
}
