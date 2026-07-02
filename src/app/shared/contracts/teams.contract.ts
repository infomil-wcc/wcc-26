export interface teamsApiData {
  data: Teams[];
}

export interface playersApiData {
  player: Player[];
}

export interface Teams {
  id: number;
  status: string;
  sort: null | any;
  owner: number;
  created_on: Date;
  modified_by: number;
  modified_on: Date;
  name: string;
  iso: string;
  group: string;
  group_points: number;
  won: number;
  draw: number;
  lost: number;
  flag_url: string;
  badge_url: string;
  information: any;
  showDetails: boolean;
  forme1: string;
  forme2: string;
  forme3: string;
  forme4: string;
  forme5: string;
  colors?: string[];
}

export interface Coach {
  role: string;
  coach_name: string;
  last_names: string;
  nationality: string;
}

export interface Player {
  shirt_number: number;
  position: 'GK' | 'DF' | 'MF' | 'FW' | string;
  player_name: string;
  last_names: string;
  name_on_shirt: string;
  date_of_birth: string; 
  club: string;
  height_cm: number;
}

export interface TeamResponse {
  country: string;
  country_code: string;
  coach: Coach;
  players: Player[];
}


export interface GroupApiData {
  data: Group[];
}

export interface Group {
  id: number;
  group_title: string;
  color: string;
  team_1: string;
  team_2: string;
  team_3: string;
  team_4: string;
  team_1_point: number;
  team_2_point: number;
  team_3_point: number;
  team_4_point: number;
}