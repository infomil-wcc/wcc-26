import { Component, OnInit, inject, Input, ViewChild, ElementRef } from '@angular/core';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs'; // Added import for Observable
import { CookieService } from 'ngx-cookie-service';
import { StateService } from '../../../shared/services/core/state.service'; // Assumed path
import { BracketService } from '../../../shared/services/games/bracket.service'; // Assumed path

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
    topScorer: { en: string };
    topAssists: { en: string };
    mostUsed:  string;
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
  // Assuming flagUrl is also part of the Country interface based on errors
  flagUrl: string; 
  flagId: string;
}

@Component({
  selector: 'app-bracket-knockout',
  templateUrl: './bracket-knockout.component.html',
  styleUrl: './bracket-knockout.component.scss'
})
export class BracketKnockoutComponent implements OnInit {
  @ViewChild('bracketWrapper') bracketWrapper!: ElementRef;

  private stateService = inject(StateService);
  private bracketService = inject(BracketService); // Injected BracketService
  private cookieService = inject(CookieService); // Injected CookieService

  @Input() isOpen: boolean = true; // Declared isOpen property
  protected currentUser!: string;
  protected resultMode: boolean = false;
  protected activeSide: 'left' | 'right' | 'all' = 'all';

  protected $bracket!: Observable<any>; // Declared $bracket property

  /**
   * Switches the active side and scrolls the container to the appropriate position
   */
  protected switchSide(side: 'left' | 'right' | 'all'): void {
    this.activeSide = side;
    
    // Small timeout to allow the DOM to update (especially if *ngIf hides/shows elements)
    setTimeout(() => {
      const container = this.bracketWrapper.nativeElement;
      if (!container) return;

      switch (side) {
        case 'left':
          container.scrollTo({ left: 0, behavior: 'smooth' });
          break;
        case 'right':
          container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
          break;
        case 'all':
          const centerPosition = (container.scrollWidth - container.clientWidth) / 2;
          container.scrollTo({ left: centerPosition, behavior: 'smooth' });
          break;
      }
    }, 50);
  }

  // --- Initial Round of 32 Team Pairings ---
// Define a clear type with an index signature [key: string]
protected r32Teams: { [key: string]: Country } = {};

  // --- Intermediate Progression State Winners ---
  // Step 1: Round of 32 Winners (16 teams total)
  protected wR32: { [key: string]: Country | null } = {};

  // Step 2: Round of 16 Winners (8 teams total)
  protected wR16: { [key: string]: Country | null } = {};

  // Step 3: Quarterfinal Winners (4 teams total)
  protected wR4: { [key: string]: Country | null } = {};

  // Step 4: Semifinal Winners (2 teams total)
  protected wS: { [key: string]: Country | null } = {};

  // Final Champion
  protected champion: Country | null = null;

  ngOnInit(): void {
    // Initialize blank choices
    this.initializePlaceholders();
    this.resetSelections();

    this.currentUser = this.cookieService.get('user_id') || 'Anonyme';
    this.$bracket = this.bracketService.getUserBracket(this.currentUser);
  }

  private initializePlaceholders(): void {
    for (let i = 1; i <= 16; i++) {
      const defaultCountry: Country = { 
        name: 'À déterminer', 
        flagId: 'tbc', 
        flagUrl: 'assets/flags/unknown.png',
        iso: '', 
        group: '', 
        coach: '', 
        worldCupAppearances: 0, 
        worldCupGoals: 0,
        bestResult: { en: '' },
        internationalTitles: [],
        qualification2026: {
          topScorer: { en: '' },
          topAssists: { en: '' },
          mostUsed:  '',
          chancesCreated: '',
          note: { en: '' },
        },
        funFacts: [],
        timeline: []
      };
      this.r32Teams[`m${i}_1`] = { ...defaultCountry };
      this.r32Teams[`m${i}_2`] = { ...defaultCountry };
    }
  }

  private resetSelections(): void {
    for (let i = 1; i <= 16; i++) this.wR32[`m${i}`] = null;
    for (let i = 1; i <= 8; i++) this.wR16[`m${i}`] = null;
    for (let i = 1; i <= 4; i++) this.wR4[`m${i}`] = null;
    for (let i = 1; i <= 2; i++) this.wS[`m${i}`] = null;
    this.champion = null;
  }

  /**
   * Turns an sequential array of 32 incoming teams into matched pairings: m1_1 vs m1_2, m2_1 vs m2_2...
   */
  private populateRoundOf32Pairs(teams: Country[]): void {
    let matchCounter = 1;
    for (let i = 0; i < teams.length; i += 2) {
      this.r32Teams[`m${matchCounter}_1`] = teams[i];
      this.r32Teams[`m${matchCounter}_2`] = teams[i + 1];
      matchCounter++;
    }
    // Reset selection matches upon receiving new team calculations
    this.resetSelections();
  }

  /**
   * Evaluates user selection and automatically handles cascading tree changes
   */
  selectWinner(stage: string, matchKey: string, selection: Country): void {
    if (!this.isOpen) return;

    switch (stage) {
      case 'R32':
        this.wR32[matchKey] = selection;
        this.resetCascadingTree('R32', matchKey);
        break;
      case 'R16':
        this.wR16[matchKey] = selection;
        this.resetCascadingTree('R16', matchKey);
        break;
      case 'R4':
        this.wR4[matchKey] = selection;
        this.resetCascadingTree('R4', matchKey);
        break;
      case 'S':
        this.wS[matchKey] = selection;
        if (this.champion && this.champion.name !== selection.name) {
          this.champion = null;
        }
        break;
      case 'Final':
        this.champion = selection;
        break;
    }
  }

  /**
   * Resets forwarding match predictions if a historical dependent prediction is modified
   */
  private resetCascadingTree(currentStage: string, matchKey: string): void {
    const num = parseInt(matchKey.replace(/\D/g, ''), 10);
    
    if (currentStage === 'R32') {
      const targetR16Match = `m${Math.ceil(num / 2)}`;
      this.wR16[targetR16Match] = null;
      const targetR4Match = `m${Math.ceil(num / 4)}`;
      this.wR4[targetR4Match] = null;
      const targetSMatch = `m${Math.ceil(num / 8)}`;
      this.wS[targetSMatch] = null;
      this.champion = null;
    } 
    else if (currentStage === 'R16') {
      const targetR4Match = `m${Math.ceil(num / 2)}`;
      this.wR4[targetR4Match] = null;
      const targetSMatch = `m${Math.ceil(num / 4)}`;
      this.wS[targetSMatch] = null;
      this.champion = null;
    } 
    else if (currentStage === 'R4') {
      const targetSMatch = `m${Math.ceil(num / 2)}`;
      this.wS[targetSMatch] = null;
      this.champion = null;
    }
  }

  isBracketComplete(): boolean {
    return !!this.champion;
  }

  validateBracket(): void {
    if (!this.isBracketComplete()) return;

    const payload = {
      status: 'published',
      user: this.currentUser,
      selections: {
        r32: this.wR32,
        r16: this.wR16,
        r4: this.wR4,
        semis: this.wS,
        champion: this.champion
      }
    };

    this.bracketService.postBracket(payload).subscribe({
      next: () => alert('Pronostic validé avec succès !'),
      error: () => alert('Erreur lors de la validation du pronostic.')
    });
  }
}