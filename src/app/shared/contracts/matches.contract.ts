export interface matchesApiData {
  data: Matches[]
}

export interface Matches {
    id: string;
    status: string;
    sort: number | null;
    owner: number;
    created_on: string;
    modified_by: number;
    modified_on: string;
    phase: string;
    date: string;
    group: string;
    team_a: string;
    team_b: string;
    played: boolean;
    halftime_a: number | null;
    halftime_b: number | null;
    fulltime_a: number | null;
    fulltime_b: number | null;
    scorers: string | null;
    winner_point: number | null;
    fulltime_point: number | null;
    halftime_point: number | null;
    scorer_point: number | null;
    stadium: string;
    fulltime: boolean | null;
    halftime: boolean | null;
    scorer: boolean | null;
    winner_draw: string | null;
}
