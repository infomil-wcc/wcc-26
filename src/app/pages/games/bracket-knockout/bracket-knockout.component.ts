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
  date?: string; // Added
  time?: string; // Added
  stadium?: string; // Added
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

  protected currentUser: string = '';
  protected resultMode: boolean = false;
  protected $bracket!: Observable<any>;

  protected r32Teams: { [key: string]: Country } = {};
  protected wR32: { [key: string]: Country | null } = {};
  protected wR16: { [key: string]: Country | null } = {};
  protected wR4: { [key: string]: Country | null } = {};
  protected wS: { [key: string]: Country | null } = {};
  protected champion: Country | null = null;
  
  // Generic Modal state
  protected showWinnerModal: boolean = false;
  protected modalContext: { stage: string, matchKey: string, team1: Country, team2: Country } | null = null;

  // Single-sided fully global match loops maps parameters
  protected matchArray16 = Array.from({ length: 16 }, (_, i) => i + 1); // 1 to 16
  protected matchArray8  = Array.from({ length: 8 },  (_, i) => i + 1); // 1 to 8
  protected matchArray4  = Array.from({ length: 4 },  (_, i) => i + 1); // 1 to 4
  protected matchArray2  = Array.from({ length: 2 },  (_, i) => i + 1); // 1 to 2

  ngOnInit(): void {
    this.initializePlaceholders();
    this.resetSelections();

    this.stateService.userState.subscribe({
      next: (user) => {
        this.currentUser = user.first_name? user.first_name : '';
      }
    })
    
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
        funFacts: [], timeline: [],
        date: '', // Added
        time: '', // Added
        stadium: '' // Added
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

  private populateRoundOf32Pairs(teams: Country[]): void {
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
        if (this.wS['m1'] && this.wS['m2']) {
          this.openWinnerModal('Final', 'f1', this.wS['m1'], this.wS['m2']);
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

  openWinnerModal(stage: string, matchKey: string, team1: Country | null | undefined, team2: Country | null | undefined): void {
    if (!team1 || !team2 || team1.name === 'À déterminer' || team2.name === 'À déterminer') return;
    this.modalContext = { stage, matchKey, team1, team2 };
    this.showWinnerModal = true;
  }

  randomizeBracket(): void {
    this.resetSelections();

    // 1. Randomize R32
    for (let i = 1; i <= 16; i++) {
      const t1 = this.r32Teams[`m${i}_1`];
      const t2 = this.r32Teams[`m${i}_2`];
      if (t1 && t2 && t1.name !== 'À déterminer' && t2.name !== 'À déterminer') {
        this.wR32[`m${i}`] = Math.random() > 0.5 ? t1 : t2;
      }
    }

    // 2. Randomize R16
    for (let i = 1; i <= 8; i++) {
      const t1 = this.wR32[`m${i * 2 - 1}`];
      const t2 = this.wR32[`m${i * 2}`];
      if (t1 && t2) this.wR16[`m${i}`] = Math.random() > 0.5 ? t1 : t2;
    }

    // 3. Randomize R4
    for (let i = 1; i <= 4; i++) {
      const t1 = this.wR16[`m${i * 2 - 1}`];
      const t2 = this.wR16[`m${i * 2}`];
      if (t1 && t2) this.wR4[`m${i}`] = Math.random() > 0.5 ? t1 : t2;
    }

    // 4. Randomize Semis
    for (let i = 1; i <= 2; i++) {
      const t1 = this.wR4[`m${i * 2 - 1}`];
      const t2 = this.wR4[`m${i * 2}`];
      if (t1 && t2) this.wS[`m${i}`] = Math.random() > 0.5 ? t1 : t2;
    }

    // 5. Randomize Champion
    if (this.wS['m1'] && this.wS['m2']) {
        this.champion = Math.random() > 0.5 ? this.wS['m1'] : this.wS['m2'];
    }
  }

  validateBracket(): void {
    if (!this.isBracketComplete()) return;

    const payload = {
      status: 'published',
      user: this.currentUser,
      winner_r32_1: this.wR32['m1']?.name,
      winner_r32_2: this.wR32['m2']?.name,
      winner_r32_3: this.wR32['m3']?.name,
      winner_r32_4: this.wR32['m4']?.name,
      winner_r32_5: this.wR32['m5']?.name,
      winner_r32_6: this.wR32['m6']?.name,
      winner_r32_7: this.wR32['m7']?.name,
      winner_r32_8: this.wR32['m8']?.name,
      winner_r32_9: this.wR32['m9']?.name,
      winner_r32_10: this.wR32['m10']?.name,
      winner_r32_11: this.wR32['m11']?.name,
      winner_r32_12: this.wR32['m12']?.name,
      winner_r32_13: this.wR32['m13']?.name,
      winner_r32_14: this.wR32['m14']?.name,
      winner_r32_15: this.wR32['m15']?.name,
      winner_r32_16: this.wR32['m16']?.name,
      winner_r16_1: this.wR16['m1']?.name,
      winner_r16_2: this.wR16['m2']?.name,
      winner_r16_3: this.wR16['m3']?.name,
      winner_r16_4: this.wR16['m4']?.name,
      winner_r16_5: this.wR16['m5']?.name,
      winner_r16_6: this.wR16['m6']?.name,
      winner_r16_7: this.wR16['m7']?.name,
      winner_r16_8: this.wR16['m8']?.name,
      winner_r4_1: this.wR4['m1']?.name,
      winner_r4_2: this.wR4['m2']?.name,
      winner_r4_3: this.wR4['m3']?.name,
      winner_r4_4: this.wR4['m4']?.name,
      winner_semi_1: this.wS['m1']?.name,
      winner_semi_2: this.wS['m2']?.name,
      winner_wc: this.champion?.name,
    };

    console.log('Payload to submit:', payload);

    // this.bracketService.postBracket(payload).subscribe({
    //   next: () => {
    //     alert('Pronostic validé avec succès !');
    //   } ,
    //   error: () => {
    //     alert('Erreur lors de la validation du pronostic.');
    //   }
    // });
  }
}