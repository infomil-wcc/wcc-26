import { Component, OnInit, inject, Input, ViewChild, ElementRef } from '@angular/core';
import { Observable } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { StateService } from '../../../shared/services/core/state.service'; 
import { BracketService } from '../../../shared/services/games/bracket.service';

export interface Country {
  name: string;
  iso: string;
  group: string;
  coach: string;
  worldCupAppearances: number;
  worldCupGoals: number;
  bestResult: { en: string };
  internationalTitles: string[];
  qualification2026: {
    topScorer: { en: string };
    topAssists: { en: string };
    mostUsed: string;
    chancesCreated: string;
    note: { en: string };
  };
  funFacts: { text: { en: string }; emoji: string; }[];
  timeline: { year: number; text: { en: string }; }[];
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
  private bracketService = inject(BracketService);
  private cookieService = inject(CookieService);

  @Input() isOpen: boolean = true;
  
  // Dynamic handler setter mapping input array of 32 elements down into sequential pairs
  @Input() set setupAdvancedTeams(teams: any[] | null) {
    if (teams && teams.length === 32) {
      this.populateRoundOf32Pairs(teams);
    }
  }

  protected currentUser!: string;
  protected resultMode: boolean = false;
  protected $bracket!: Observable<any>;

  protected r32Teams: { [key: string]: Country } = {};
  protected wR32: { [key: string]: Country | null } = {};
  protected wR16: { [key: string]: Country | null } = {};
  protected wR4: { [key: string]: Country | null } = {};
  protected wS: { [key: string]: Country | null } = {};
  protected champion: Country | null = null;

  // Single-sided fully global match loops maps parameters
  protected matchArray16 = Array.from({ length: 16 }, (_, i) => i + 1); // 1 to 16
  protected matchArray8  = Array.from({ length: 8 },  (_, i) => i + 1); // 1 to 8
  protected matchArray4  = Array.from({ length: 4 },  (_, i) => i + 1); // 1 to 4
  protected matchArray2  = Array.from({ length: 2 },  (_, i) => i + 1); // 1 to 2

  ngOnInit(): void {
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
        iso: '', group: '', coach: '', worldCupAppearances: 0, worldCupGoals: 0,
        bestResult: { en: '' }, internationalTitles: [],
        qualification2026: { topScorer: { en: '' }, topAssists: { en: '' }, mostUsed: '', chancesCreated: '', note: { en: '' } },
        funFacts: [], timeline: []
      };
      this.r32Teams[`m${i}_1`] = { ...defaultCountry };
      this.r32Teams[`m${i}_2`] = { ...defaultCountry };
    }
  }

  private resetSelections(): void {
    for (let i = 1; i <= 16; i++) this.wR32[`m${i}`] = null;
    for (let i = 1; i <= 8; i++)  this.wR16[`m${i}`] = null;
    for (let i = 1; i <= 4; i++)  this.wR4[`m${i}`] = null;
    for (let i = 1; i <= 2; i++)  this.wS[`m${i}`] = null;
    this.champion = null;
  }

  private populateRoundOf32Pairs(teams: any[]): void {
    let matchCounter = 1;
    for (let i = 0; i < teams.length; i += 2) {
      this.r32Teams[`m${matchCounter}_1`] = teams[i];
      this.r32Teams[`m${matchCounter}_2`] = teams[i + 1];
      matchCounter++;
    }
    this.resetSelections();
  }

  selectWinner(stage: string, matchKey: string, selection: Country): void {
    if (!this.isOpen || selection.name === 'À déterminer') return;

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