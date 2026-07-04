import { Injectable } from '@angular/core';
import { PlayersApiService } from '../api/players-api.service';
import { firstValueFrom } from 'rxjs';

export interface DbPlayer {
  id: number;
  player_name: string;
  country: string;
  aliases?: string[];
}

export interface ApiScorerMatch {
  apiName: string;
  matchedPlayer: DbPlayer | null;
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class ScorerMatchingService {

  private players: DbPlayer[] = [];
  private loaded = false;

  constructor(private playersApi: PlayersApiService) { }

  // =========================
  // PUBLIC ENTRY
  // =========================
  async resolveScorers(apiScorers: string[]): Promise<ApiScorerMatch[]> {
    await this.loadPlayersIfNeeded();
    return apiScorers.map(s => this.matchSingle(s));
  }

  // =========================
  // LOAD DB PLAYERS
  // =========================
  private async loadPlayersIfNeeded(): Promise<void> {
    if (this.loaded) return;

    const res = await firstValueFrom(this.playersApi.getPlayers());

    this.players = (res?.data || []).map((p: any) => ({
      id: p.id,
      player_name: p.player_name,
      country: p.country,
      aliases: p.aliases || []
    }));

    this.loaded = true;
  }

  // =========================
  // CORE MATCHER
  // =========================
  private matchSingle(apiRaw: string): ApiScorerMatch {
    const apiClean = this.cleanScorerName(apiRaw);
    const apiParts = this.splitName(apiClean);

    let best: DbPlayer | null = null;
    let bestScore = 0;

    for (const player of this.players) {
      const score = this.scorePlayer(apiParts, player);

      if (score > bestScore) {
        bestScore = score;
        best = player;
      }
    }

    return {
      apiName: apiRaw,
      matchedPlayer: bestScore >= 0.55 ? best : null,
      confidence: bestScore
    };
  }

  // =========================
  // SCORING ENGINE
  // =========================
  private scorePlayer(apiParts: string[], player: DbPlayer): number {
    const dbVariants = this.buildDbVariants(player);

    let best = 0;

    for (const variant of dbVariants) {
      const dbParts = this.splitName(variant);
      const score = this.scoreParts(apiParts, dbParts);
      if (score > best) best = score;
    }

    return best;
  }

  // =========================
  // MAIN SCORING LOGIC
  // =========================
  private scoreParts(api: string[], db: string[]): number {
    let score = 0;

    const apiFirst = api[0];
    const apiLast = api[api.length - 1];

    const dbFirst = db[0];
    const dbLast = db[db.length - 1];

    if (api.join(' ') === db.join(' ')) return 1;

    if (apiLast && dbLast && apiLast === dbLast) {
      score += 0.6;
    }

    if (apiFirst && dbFirst && apiFirst === dbFirst) {
      score += 0.3;
    }

    if (apiFirst === dbLast && apiLast === dbFirst) {
      score += 0.85;
    }

    if (this.isInitialMatch(apiFirst, dbFirst)) {
      score += 0.25;
    }

    score += this.tokenSimilarity(api.join(' '), db.join(' ')) * 0.4;

    return Math.min(score, 1);
  }

  // =========================
  // DB VARIANTS
  // =========================
  private buildDbVariants(player: DbPlayer): string[] {
    const base = this.cleanScorerName(player.player_name);
    const parts = this.splitName(base);

    const variants = new Set<string>();

    variants.add(base);

    if (parts.length > 1) {
      variants.add([...parts].reverse().join(' '));
      variants.add(`${parts[0]} ${parts[1][0]}`);
    }

    for (const a of player.aliases || []) {
      variants.add(this.cleanScorerName(a));
    }

    return [...variants];
  }

  // =========================
  // NORMALIZATION
  // =========================
  private cleanScorerName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\d+/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/['".]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitName(name: string): string[] {
    return name.split(' ').filter(Boolean);
  }

  private isInitialMatch(a?: string, b?: string): boolean {
    if (!a || !b) return false;

    return (
      (a.length === 1 && b.startsWith(a)) ||
      (b.length === 1 && a.startsWith(b))
    );
  }

  private tokenSimilarity(a: string, b: string): number {
    const aSet = new Set(a.split(' '));
    const bSet = new Set(b.split(' '));

    const intersection = [...aSet].filter(x => bSet.has(x)).length;
    const union = new Set([...aSet, ...bSet]).size;

    return union === 0 ? 0 : intersection / union;
  }
}