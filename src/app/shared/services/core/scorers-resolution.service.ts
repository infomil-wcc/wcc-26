// scorer-matching.service.ts

export interface DbPlayer {
  player_id: number;
  player_name: string;
  country: string;
}

export interface ApiScorerMatch {
  apiName: string;
  matchedPlayer: DbPlayer | null;
  confidence: number;
}

export class ScorerMatchingService {
  private players: DbPlayer[] = [];

  constructor(playersFromDb: DbPlayer[]) {
    this.players = playersFromDb;
  }

  /**
   * Main entry point
   */
  public resolveScorers(apiScorers: string[]): ApiScorerMatch[] {
    return apiScorers.map(apiName => this.matchSingle(apiName));
  }

  /**
   * Match a single scorer
   */
  private matchSingle(apiName: string): ApiScorerMatch {
    const normalizedApi = this.normalize(apiName);

    let bestMatch: DbPlayer | null = null;
    let bestScore = 0;

    for (const player of this.players) {
      const score = this.scoreMatch(normalizedApi, player);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = player;
      }
    }

    return {
      apiName,
      matchedPlayer: bestMatch && bestScore >= 0.6 ? bestMatch : null,
      confidence: bestScore
    };
  }

  /**
   * Scoring logic (core upgrade point)
   */
  private scoreMatch(apiName: string, player: DbPlayer): number {
    const dbName = this.normalize(player.player_name);

    // 1. Exact match
    if (apiName === dbName) return 1;

    // 2. Substring match (Mbappé vs Kylian Mbappé)
    if (apiName.includes(dbName) || dbName.includes(apiName)) {
      return 0.85;
    }

    // 3. Token match (fuzzy lightweight)
    return this.tokenSimilarity(apiName, dbName);
  }

  /**
   * Lightweight fuzzy similarity (no dependency)
   */
  private tokenSimilarity(a: string, b: string): number {
    const aTokens = new Set(a.split(' '));
    const bTokens = new Set(b.split(' '));

    const intersection = [...aTokens].filter(x => bTokens.has(x)).length;
    const union = new Set([...aTokens, ...bTokens]).size;

    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Normalization layer (VERY important for football names)
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // removes accents
      .replace(/['".()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}