export interface pronostiquesApiData {
  data: Pronostiques[]
}

export interface Pronostiques {
  id?: number;
  sort?: number | null;
  owner?: number;
  created_on?: string;
  modified_by?: number;
  modified_on?: string;
  user: string;
  game_id: string;
  halftime_a?: string;
  halftime_b?: string;
  fulltime_a?: string;
  fulltime_b?: string;
  scorer?: string;
  first_team_scoring?: string;
  winner_draw?: string;
}