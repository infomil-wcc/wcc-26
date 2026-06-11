import { Component, OnInit, inject, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { StateService } from '../../../shared/services/core/state.service'; 
import { BracketService } from '../../../shared/services/games/bracket.service';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { TeamsService } from '../../../shared/services/content/teams.service';

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
  @ViewChild('headersSync') headersSync!: ElementRef;

  private stateService = inject(StateService);
  private bracketService = inject(BracketService);
  private cookieService = inject(CookieService);
  private matchesService = inject(MatchesService);
  private teamsService = inject(TeamsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen: boolean = true;

  protected syncHeadersScroll(): void {
    if (this.headersSync && this.bracketWrapper) {
      this.headersSync.nativeElement.scrollLeft = this.bracketWrapper.nativeElement.scrollLeft;
    }
  }
  
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
  // Validated (read-only) snapshot
  protected validated: boolean = false;
  protected vR32: { [key: string]: Country | null } = {};
  protected vR16: { [key: string]: Country | null } = {};
  protected vR4: { [key: string]: Country | null } = {};
  protected vS: { [key: string]: Country | null } = {};
  protected vChampion: Country | null = null;
  
  // Generic Modal state
  protected showWinnerModal: boolean = false;
  protected modalContext: { stage: string, matchKey: string, team1: Country, team2: Country } | null = null;

  // Single-sided fully global match loops maps parameters
  protected matchArray16 = Array.from({ length: 16 }, (_, i) => i + 1); // 1 to 16
  protected matchArray8  = Array.from({ length: 8 },  (_, i) => i + 1); // 1 to 8
  protected matchArray4  = Array.from({ length: 4 },  (_, i) => i + 1); // 1 to 4
  protected matchArray2  = Array.from({ length: 2 },  (_, i) => i + 1); // 1 to 2

  protected matchDetails: { [key: string]: { date: string, time: string, stadium: string } | undefined } = {};
  // Cached map of known flags from the teams service (name -> { url, iso })
  protected flagMap: Map<string, { url: string, iso?: string }> = new Map();

  private normalizeName(input?: string | null): string {
    if (!input) return '';
    try {
      const cleaned = String(input).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
      // common aliases / legacy names
      if (cleaned === 'turkiye' || cleaned === 'türkiye') return 'turkey';
      return cleaned;
    } catch {
      return String(input).trim().toLowerCase();
    }
  }

  ngOnInit(): void {
    this.initializePlaceholders();
    this.resetSelections();

    this.stateService.userState.subscribe({
      next: (user) => {
        this.currentUser = user.first_name? user.first_name : '';
        // fetch saved bracket once we have the current user
        this.$bracket = this.bracketService.getUserBracket(this.currentUser);
        this.$bracket.subscribe({
          next: (data) => {
            console.log(data);
            if (data && Array.isArray(data) && data.length > 0) {
              // use the first saved bracket
              this.applySavedBracket(data[0]);
            }
          },
          error: () => {
            // ignore errors retrieving saved bracket
          }
        });
      }
    });

    // Fetch matches to populate dates, times, and stadiums
    this.matchesService.getAllMatches().subscribe({
      next: (matches) => {
        this.populateMatchDetails(matches);
      }
    });

    // Cache available flags from the teams service so we can resolve names -> flagUrl later
    this.teamsService.getFlags().subscribe({
      next: (flags: any[]) => {
        try {
          flags.forEach((f: any) => {
            if (f && f.name) {
              const key = this.normalizeName(f.name);
              this.flagMap.set(key, { url: f.flag_url || f.url || 'assets/flags/unknown.png', iso: (f.iso || f.iso_code || '').toLowerCase() });
            }
          });
          // After flags populate, refresh any already-applied saved entries
          this.resolveSavedFlags();
        } catch {
          // ignore
        }
      }
    });
  }

  // Try to replace unknown flagUrls in existing objects using flagMap lookups
  private resolveSavedFlags(): void {
    const resolveFor = (obj: { [key: string]: Country | null } | { [key: string]: Country }) => {
      for (const k of Object.keys(obj)) {
        const c = (obj as any)[k] as Country | null;
        if (!c || !c.name) continue;
        const nameKey = this.normalizeName(c.name);
        const fromMap = this.flagMap.get(nameKey);
        if (fromMap && fromMap.url && fromMap.url !== 'assets/flags/unknown.png') {
          (obj as any)[k] = { ...c, flagUrl: fromMap.url, flagId: fromMap.iso || (c.flagId || '') } as Country;
        } else {
          // fuzzy attempt
          for (const [mk, mv] of this.flagMap.entries()) {
            if (mk.includes(nameKey) || nameKey.includes(mk)) {
              (obj as any)[k] = { ...c, flagUrl: mv.url, flagId: mv.iso || (c.flagId || '') } as Country;
              break;
            }
          }
        }
      }
    };

    resolveFor(this.r32Teams);
    resolveFor(this.wR32);
    resolveFor(this.vR32);
    resolveFor(this.wR16);
    resolveFor(this.vR16);
    resolveFor(this.wR4);
    resolveFor(this.vR4);
    resolveFor(this.wS);
    resolveFor(this.vS);
    if (this.vChampion && this.vChampion.name) {
      const key = this.normalizeName(this.vChampion.name);
      const m = this.flagMap.get(key);
      if (m && m.url && m.url !== 'assets/flags/unknown.png') {
        this.vChampion.flagUrl = m.url;
        this.vChampion.flagId = m.iso || this.vChampion.flagId;
      }
    }
    this.cdr.detectChanges();
  }

  private populateMatchDetails(matches: any[]): void {
    matches.forEach((m: any) => {
      let key = '';
      if (m.phase === 'Round of 32') {
        const index = m.id - 72; // ID 73 -> index 1
        key = `R32_m${index}`;
      } else if (m.phase === 'Round of 16') {
        const index = m.id - 88; // ID 89 -> index 1
        key = `R16_m${index}`;
      } else if (m.phase === 'Quarter-finals') {
        const index = m.id - 96; // ID 97 -> index 1
        key = `R4_m${index}`;
      } else if (m.phase === 'Semi-finals') {
        const index = m.id - 100; // ID 101 -> index 1
        key = `S_m${index}`;
      } else if (m.phase === 'Final') {
        key = `Final_f1`;
      }

      if (key) {
        let datePart = '-';
        let timePart = '';
        if (m.date) {
          const formatted = this.formatMatchDate(m.date);
          datePart = formatted.date;
          timePart = formatted.time;
        }
        this.matchDetails[key] = {
          date: datePart,
          time: timePart,
          stadium: m.stadium || 'Inconnu'
        };
      }
    });
    this.cdr.detectChanges();
  }

  private formatMatchDate(rawDateStr: string): { date: string, time: string } {
    try {
      const formattedStr = rawDateStr.replace(' ', 'T');
      const d = new Date(formattedStr);
      if (isNaN(d.getTime())) {
        return { date: rawDateStr, time: '' };
      }

      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayName = days[d.getDay()];

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');

      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;

      return {
        date: `${dayName} ${day}-${month} ${hours}${ampm}`,
        time: ''
      };
    } catch {
      return { date: rawDateStr, time: '' };
    }
  }

  private createPlaceholderCountry(name: string = 'À déterminer'): Country {
    return {
      name,
      flagId: 'tbc',
      flagUrl: 'assets/flags/unknown.png',
      iso: '', group: '', coach: '', worldCupAppearances: 0, worldCupGoals: 0,
      bestResult: { en: '' }, internationalTitles: [],
      qualification2026: { topScorer: { en: '' }, topAssists: { en: '' }, mostUsed: '', chancesCreated: '', note: { en: '' } },
      funFacts: [], timeline: [], date: '', time: '', stadium: ''
    };
  }

  private mapNameToCountry(name?: string | null): Country | null {
    if (!name) return null;
    const nameNorm = this.normalizeName(name);

    // 1) Prefer resolving via flagMap (exact then fuzzy) so we get full flagUrl even if r32Teams contains placeholders
    const exact = this.flagMap.get(nameNorm);
    if (exact) {
      return {
        name,
        flagUrl: exact.url || 'assets/flags/unknown.png',
        flagId: (exact.iso || name.substring(0,2)).toLowerCase(),
        iso: exact.iso || '', group: '', coach: '', worldCupAppearances: 0, worldCupGoals: 0,
        bestResult: { en: '' }, internationalTitles: [],
        qualification2026: { topScorer: { en: '' }, topAssists: { en: '' }, mostUsed: '', chancesCreated: '', note: { en: '' } },
        funFacts: [], timeline: [], date: '', time: '', stadium: ''
      };
    }

    for (const [k, v] of this.flagMap.entries()) {
      if (k.includes(nameNorm) || nameNorm.includes(k)) {
        return {
          name,
          flagUrl: v.url || 'assets/flags/unknown.png',
          flagId: (v.iso || name.substring(0,2)).toLowerCase(),
          iso: v.iso || '', group: '', coach: '', worldCupAppearances: 0, worldCupGoals: 0,
          bestResult: { en: '' }, internationalTitles: [],
          qualification2026: { topScorer: { en: '' }, topAssists: { en: '' }, mostUsed: '', chancesCreated: '', note: { en: '' } },
          funFacts: [], timeline: [], date: '', time: '', stadium: ''
        };
      }
    }

    // 2) Then search existing in-memory maps (use normalized comparisons) so we don't return placeholders when full info exists
    for (const key of Object.keys(this.r32Teams)) {
      const c = this.r32Teams[key];
      if (c && this.normalizeName(c.name) === nameNorm) return c;
    }

    const searches = [this.wR32, this.wR16, this.wR4, this.wS, this.vR32, this.vR16, this.vR4, this.vS];
    for (const map of searches) {
      for (const k of Object.keys(map)) {
        const c = map[k];
        if (c && this.normalizeName((c as Country).name) === nameNorm) return c as Country;
      }
    }

    // last resort: return a minimal Country placeholder so UI can display the name
    return this.createPlaceholderCountry(name);
  }

  private applySavedBracket(payload: any): void {
    if (!payload) return;
    // Attempt to reconstruct full R32 teams from payload if present
    const extracted: any[] = [];
    if (Array.isArray(payload.r32) && payload.r32.length >= 32) {
      extracted.push(...payload.r32.slice(0, 32));
    } else if (Array.isArray(payload.teams32) && payload.teams32.length >= 32) {
      extracted.push(...payload.teams32.slice(0, 32));
    } else if (Array.isArray(payload.advancedQualifiers) && payload.advancedQualifiers.length >= 32) {
      extracted.push(...payload.advancedQualifiers.slice(0, 32));
    } else {
      for (let i = 1; i <= 16; i++) {
        const candidatesLeft = [
          payload[`r32_${i}_1`], payload[`r32_${i}1`], payload[`team_r32_${i}_1`], payload[`m${i}_1`]
        ];
        const candidatesRight = [
          payload[`r32_${i}_2`], payload[`r32_${i}2`], payload[`team_r32_${i}_2`], payload[`m${i}_2`]
        ];
        const leftRaw = candidatesLeft.find(v => v !== undefined && v !== null);
        const rightRaw = candidatesRight.find(v => v !== undefined && v !== null);

        const normalize = (raw: any) => {
          if (!raw) return null;
          if (typeof raw === 'string') return { name: raw, flagUrl: 'assets/flags/unknown.png', flagId: raw.substring(0,2).toLowerCase() };
          if (raw.name) return raw;
          return null;
        }

        const left = normalize(leftRaw);
        const right = normalize(rightRaw);
        extracted.push(left || this.createPlaceholderCountry());
        extracted.push(right || this.createPlaceholderCountry());
      }
    }

    if (extracted.length >= 32) {
      this.populateRoundOf32Pairs(extracted.slice(0,32) as Country[]);
    }
    // populate validated maps from payload fields
    for (let i = 1; i <= 16; i++) {
      const name = payload[`winner_r32_${i}`];
      const winnerCountry = this.mapNameToCountry(name);
      this.vR32[`m${i}`] = winnerCountry;
      // also put winner into the R32 pair first slot so the match shows the selected team
      if (winnerCountry) {
        const slot1Key = `m${i}_1`;
        const slot2Key = `m${i}_2`;
        const slot1 = this.r32Teams[slot1Key];
        const slot2 = this.r32Teams[slot2Key];
        const isSlot1Placeholder = !slot1 || slot1.name === 'À déterminer';
        const isSlot2Placeholder = !slot2 || slot2.name === 'À déterminer';

        if (isSlot1Placeholder && isSlot2Placeholder) {
          // No original pair available — show the winner in the first slot only
          // and keep the second slot as a placeholder so it doesn't appear duplicated
          this.r32Teams[slot1Key] = winnerCountry;
          this.r32Teams[slot2Key] = this.createPlaceholderCountry();
        } else if (isSlot1Placeholder) {
          this.r32Teams[slot1Key] = winnerCountry;
        } else if (isSlot2Placeholder) {
          this.r32Teams[slot2Key] = winnerCountry;
        } else {
          // both slots present; ensure at least one matches the winner name
          if (slot1.name !== winnerCountry.name && slot2.name !== winnerCountry.name) {
            this.r32Teams[slot1Key] = winnerCountry;
          }
        }
      }
    }
    for (let i = 1; i <= 8; i++) {
      this.vR16[`m${i}`] = this.mapNameToCountry(payload[`winner_r16_${i}`]);
    }
    for (let i = 1; i <= 4; i++) {
      this.vR4[`m${i}`] = this.mapNameToCountry(payload[`winner_r4_${i}`]);
    }
    for (let i = 1; i <= 2; i++) {
      this.vS[`m${i}`] = this.mapNameToCountry(payload[`winner_semi_${i}`]);
    }
    this.vChampion = this.mapNameToCountry(payload[`winner_wc`]);
    this.validated = true;
    // Ensure flags are resolved now that validated maps are populated
    this.resolveSavedFlags();
  }

  private initializePlaceholders(): void {
    for (let i = 1; i <= 16; i++) {
      this.r32Teams[`m${i}_1`] = this.createPlaceholderCountry();
      this.r32Teams[`m${i}_2`] = this.createPlaceholderCountry();
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

  getWinner(stage: string, matchKey: string): Country | null {
    if (this.validated) {
      if (stage === 'R32') return this.vR32[matchKey] || null;
      if (stage === 'R16') return this.vR16[matchKey] || null;
      if (stage === 'R4') return this.vR4[matchKey] || null;
      if (stage === 'S') return this.vS[matchKey] || null;
      if (stage === 'Final') return this.vChampion || null;
    } else {
      if (stage === 'R32') return this.wR32[matchKey] || null;
      if (stage === 'R16') return this.wR16[matchKey] || null;
      if (stage === 'R4') return this.wR4[matchKey] || null;
      if (stage === 'S') return this.wS[matchKey] || null;
      if (stage === 'Final') return this.champion || null;
    }
    return null;
  }

  getTeam(stage: string, matchKey: string, slot: number): Country | null {
    const num = parseInt(matchKey.replace(/\D/g, ''), 10);
    if (stage === 'R32') {
      return this.r32Teams[`${matchKey}_${slot}`] || null;
    }

    const prevWinnerMap = this.validated ? {
      'R16': this.vR32,
      'R4': this.vR16,
      'S': this.vR4,
      'Final': this.vS
    } : {
      'R16': this.wR32,
      'R4': this.wR16,
      'S': this.wR4,
      'Final': this.wS
    };

    const prevStage = stage === 'R16' ? 'R16' : (stage === 'R4' ? 'R4' : (stage === 'S' ? 'S' : 'Final'));
    const sourceMap = (prevWinnerMap as any)[prevStage];
    const sourceMatchKey = stage === 'Final' ? `m${slot}` : `m${(num * 2) - (2 - slot)}`;
    return sourceMap ? (sourceMap[sourceMatchKey] || null) : null;
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

    const payload: any = {
      status: 'published',
      user: this.currentUser,
      winner_wc: this.champion?.name
    };

    for (let i = 1; i <= 16; i++) {
      payload[`winner_r32_${i}`] = this.wR32[`m${i}`]?.name;
    }
    for (let i = 1; i <= 8; i++) {
      payload[`winner_r16_${i}`] = this.wR16[`m${i}`]?.name;
    }
    for (let i = 1; i <= 4; i++) {
      payload[`winner_r4_${i}`] = this.wR4[`m${i}`]?.name;
    }
    for (let i = 1; i <= 2; i++) {
      payload[`winner_semi_${i}`] = this.wS[`m${i}`]?.name;
    }

    console.log('Payload to submit:', payload);

    this.bracketService.postBracket(payload).subscribe({
      next: () => {
        alert('Pronostic validé avec succès !');
        // take a snapshot of the current bracket to show as a read-only validated view
        this.takeValidatedSnapshot();
        this.validated = true;
      } ,
      error: () => {
        alert('Erreur lors de la validation du pronostic.');
      }
    });
  }

  private takeValidatedSnapshot(): void {
    // Deep copy selections into validated maps
    for (let i = 1; i <= 16; i++) this.vR32[`m${i}`] = this.wR32[`m${i}`] ? { ...this.wR32[`m${i}`] as Country } : null;
    for (let i = 1; i <= 8; i++) this.vR16[`m${i}`] = this.wR16[`m${i}`] ? { ...this.wR16[`m${i}`] as Country } : null;
    for (let i = 1; i <= 4; i++) this.vR4[`m${i}`] = this.wR4[`m${i}`] ? { ...this.wR4[`m${i}`] as Country } : null;
    for (let i = 1; i <= 2; i++) this.vS[`m${i}`] = this.wS[`m${i}`] ? { ...this.wS[`m${i}`] as Country } : null;
    this.vChampion = this.champion ? { ...this.champion } : null;
  }
}