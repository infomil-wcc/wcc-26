export interface PhaseDetail {
  nom_affiche?: string;
  regles: string;
  points_info?: string;
  categories_predictions?: string[];
}

export interface PointsRow {
  cat: string;
  vals: (number | string)[];
}

export interface CalculationDetail {
  prediction: string;
  points: number;
}

export interface CalculationExample {
  type: string;
  scenario: string;
  details: CalculationDetail[];
  total: number;
}

export interface GameElement {
  id: string;
  nom: string;
  description: string;
  date_debut?: string;
  date_fin?: string;
  phases?: Record<string, PhaseDetail>;
  bareme_points_detaille?: {
    colonnes: string[];
    rows: PointsRow[];
    total_points_competition: number;
  };
  exemples_calcul?: CalculationExample[];
  conditions_victoire_et_egalite?: {
    regle_principale: string;
    departage_egalite: string[];
  };
  elements_a_predire?: string[];
  systeme_points_departage?: {
    introduction: string;
    points: Record<string, number>;
  };
  bareme_points?: Record<string, number>;
  interet?: string;
  conditions_egalite?: {
    etape_1: string;
    etape_2: string;
    ordre_priorite_phases: string[];
  };
  regles?: string[];
}

export interface ApiResponse {
  titre_general: string;
  introduction: string;
  elements: GameElement[];
}
