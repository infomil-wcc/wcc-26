import { Component, OnInit } from '@angular/core';
import { CommonModule, KeyValue } from '@angular/common';

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

@Component({
  selector: 'app-game-rules',
  templateUrl: './game-rules.component.html',
  styleUrls: ['./game-rules.component.scss']
})
export class GameRulesComponent implements OnInit {
  
  apiResponse = {
    "titre_general": "FAQ - Règles et Conditions des jeux",
    "introduction": "Le jeu consiste à prédire différents éléments liés à la compétition (résultats des matchs, performances individuelles et tableau final). Les participants cumulent des points en fonction de la justesse de leurs pronostics. Le/la participant(e) ayant obtenu le plus de points remporte le jeu.",
    "elements": [
      {
        "id": "jeu_pronostics",
        "nom": "Jeu de pronostics : à toi de jouer !",
        "description": "Prédire différents éléments liés à la compétition (résultats des matchs, performances individuelles et tableau final).",
        "date_debut": "2026-06-10",
        "phases": {
          "phase_de_groupes": { "nom_affiche": "⚽ Phase de groupes", "regles": "Devine le résultat de chaque match : victoire ou match nul.", "points_info": "Bonne réponse = points gagnés. Bonus si tu trouves le score exact !" },
          "seiziemes_de_finale": { "nom_affiche": "🚪 16èmes de finale", "regles": "Les choses sérieuses commencent : Plus tu avances, plus les points augmentent !", "points_info": "Trouver le vainqueur ou le nul rapporte davantage. Score exact = encore plus de points." },
          "huitiemes_de_finale": { "nom_affiche": "⚔️ 8èmes de finale", "regles": "Nouveautés pour booster ton score.", "categories_predictions": ["Score à la mi-temps", "Un buteur du match", "Point de consolation (1 point si raté complètement)"] },
          "quarts_demis_troisieme_place": { "nom_affiche": "🥉 Quarts & demis (+ 3e place)", "regles": "Tout compte encore plus, les gains augmentent sur toutes les catégories !", "categories_predictions": ["Vainqueur", "Score final", "Score à la mi-temps", "Buteur"] },
          "finale": { "nom_affiche": "🏆 Finale", "regles": "Là, c’est le jackpot, les points sont au maximum !", "categories_predictions": ["Vainqueur ou nul", "Mi-temps", "Score final (prolongations incluses)", "Buteur"] }
        },
        "bareme_points_detaille": {
          "colonnes": ["Catégories", "Phase de Groupes", "16ᵉˢ", "8ᵉˢ", "Quarts/Demis", "Finale"],
          "rows": [
            { cat: "Trouver le bon vainqueur / Match nul", vals: [1, 2, 3, 4, 5] },
            { cat: "Score final (jusqu'à prolongation)", vals: ["+2", "+4", "+5", "+6", "+10"] },
            { cat: "Score mi-temps", vals: ['-', '-', "+2", "+3", "+5"] },
            { cat: "Nom d'un buteur", vals: ['-', '-', "+1", "+2", "+4"] },
            { cat: "Point de consolation (si 0 pt)", vals: ['-', '-', 1, 1, 1] },
            { cat: "Nombre de matchs", vals: [72, 16, 8, 7, 1] },
            { cat: "Points max possible / match", vals: [3, 6, 11, 15, 24] },
            { cat: "Total points possible", vals: [216, 96, 88, 105, 24] }
          ],
          "total_points_competition": 529
        },
        "exemples_calcul": [
          {
            "type": "Exemple en quart de finale",
            "scenario": "Un joueur pronostique sur un match de 1/4 de finale",
            "details": [
              { "prediction": "Bon vainqueur", "points": 4 },
              { "prediction": "Score exact du match", "points": 6 },
              { "prediction": "Score exact à la mi-temps", "points": 3 },
              { "prediction": "Buteur correct (Kylian Mbappé)", "points": 2 }
            ],
            "total": 15
          },
          {
            "type": "Exemple de point de consolation",
            "scenario": "Lors d’un match des 8èmes de finale, le joueur ne trouve ni le vainqueur, ni le score exact, ni la mi-temps, ni le buteur",
            "details": [
              { "prediction": "Participation sans aucune bonne réponse", "points": 1 }
            ],
            "total": 1
          }
        ],
        "conditions_victoire_et_egalite": {
          "regle_principale": "Celui ou celle avec le plus de points remporte le prix !",
          "departage_egalite": ["Celui avec le plus de prédictions correctes gagne."]
        }
      },
      {
        "id": "predictions_stars",
        "nom": "Prédictions des stars du tournoi",
        "description": "Pronostiquer sur les meilleures performances individuelles de la compétition.",
        "date_debut": "2026-06-08",
        "elements_a_predire": ["Le meilleur buteur du tournoi", "Le nombre de buts qu’il marquera", "Le meilleur joueur de la compétition"],
        "systeme_points_departage": {
          "introduction": "Si personne ne trouve la combinaison parfaite, on départage avec ce système (plus tu es proche, plus tu marques de points) :",
          "points": { "Nom du meilleur buteur": 4, "Nombre de buts inscrits par le meilleur buteur": 2, "Nom du meilleur joueur du tournoi": 1 }
        }
      },
      {
        "id": "jeu_bracket",
        "nom": "Jeu bracket",
        "description": "Une fois la phase des groupes terminés, devine les vainqueurs de chaque match jusqu’à la finale.",
        "date_debut": "2026-06-28",
        "bareme_points": { "16eme_de_finale": 5, "8eme_de_finale": 10, "quart_de_finale": 15, "demi_finale": 20, "finale": 25 },
        "interet": "Chaque bon vainqueur te fait grimper au classement !",
        "conditions_egalite": {
          "etape_1": "Le participant ayant le plus grand nombre de prédictions correctes est déclaré gagnant.",
          "etape_2": "En cas d’égalité, on compare la précision des équipes gagnantes pronostiquées, en donnant la priorité aux phases les plus avancées :",
          "ordre_priorite_phases": ["Finale", "Demi-finales", "Quarts", "Huitièmes"]
        }
      },
      {
        "id": "Conditions",
        "nom": "Conditions générales",
        "regles": [
          "La participation au jeu implique l’acceptation complète du présent règlement.",
          "L’organisation se réserve le droit de trancher toute situation non prévue."
        ]
      }
    ]
  };

  titleGeneral = '';
  introduction = '';
  sortedSteps: GameElement[] = [];
  
  activeStepIndex = 0;
  openAccordionIndex: number | null = 0;

  ngOnInit() {
    this.titleGeneral = this.apiResponse.titre_general;
    this.introduction = this.apiResponse.introduction;

    const gamePhases = this.apiResponse.elements.filter(e => e.date_debut) as GameElement[];
    const rulesClauses = this.apiResponse.elements.filter(e => !e.date_debut) as GameElement[];

    gamePhases.sort((a, b) => new Date(a.date_debut!).getTime() - new Date(b.date_debut!).getTime());

    this.sortedSteps = [...gamePhases, ...rulesClauses];
  }

  goToStep(index: number) {
    if (index >= 0 && index < this.sortedSteps.length) {
      this.activeStepIndex = index;
    }
  }

  nextStep() {
    if (this.activeStepIndex < this.sortedSteps.length - 1) {
      this.activeStepIndex++;
    }
  }

  prevStep() {
    if (this.activeStepIndex > 0) {
      this.activeStepIndex--;
    }
  }

  resetStepper() {
    this.activeStepIndex = 0;
  }

  toggleAccordion(index: number) {
    this.openAccordionIndex = this.openAccordionIndex === index ? null : index;
  }

  formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace('eme', 'ème');
  }
}