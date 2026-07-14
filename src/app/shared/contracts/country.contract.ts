export interface Country {
  name: string;
  iso: string;
  group: string;
  coach: string;
  worldCupAppearances: number;
  worldCupGoals: number;

  bestResult: {
    en: string;
  };

  internationalTitles: string[];

  qualification2026: {
    topScorer: string;
    topAssists: string;
    mostUsed: string;
    chancesCreated: string;
    note: { en: string };
  };

  funFacts: {
    text: { en: string };
    emoji: string;
  }[];

  timeline: {
    year: number;
    text: { en: string };
  }[];
}
