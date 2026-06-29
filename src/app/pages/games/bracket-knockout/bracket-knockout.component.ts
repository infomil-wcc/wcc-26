import { Component, OnInit, inject, Input, ViewChild, ElementRef, ChangeDetectorRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, forkJoin } from 'rxjs';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { StateService } from '../../../shared/services/core/state.service'; 
import { BracketService } from '../../../shared/services/games/bracket.service';
import { MatchesService } from '../../../shared/services/content/matches.service';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { BracketResultApiService } from '../../../shared/services/api/bracket-result-api.service';
import { GameRulesService } from '../../../shared/services/content/game-rules.service';
import { KnockoutBracketService } from '../../../shared/services/games/knockout-bracket.service';

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
    styleUrl: './bracket-knockout.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule]
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
  private bracketResultApiService = inject(BracketResultApiService);
  private gameRulesService = inject(GameRulesService);
  private knockoutBracketService = inject(KnockoutBracketService);

  @Input() isOpen: boolean = true;
  @Input() isKnockoutPhase2: boolean = false;

  getStartingTeamEvaluation(mIdx: number, slot: number): { status: string, points: number } | null {
    if (!this.validated || !this.realR32Teams || this.realR32Teams.size === 0) return null;
    const team = this.getTeam('R32', 'm' + mIdx, slot);
    if (!team || !team.name || team.name === 'À déterminer') return null;
    
    // Check if the team is in the real R32 teams
    const isCorrect = this.realR32Teams.has(team.name.toLowerCase().trim());
    return {
      status: isCorrect ? 'correct' : 'incorrect',
      points: isCorrect ? 10 : 0
    };
  }

  protected syncHeadersScroll(): void {
    if (this.headersSync && this.bracketWrapper) {
      this.headersSync.nativeElement.scrollLeft = this.bracketWrapper.nativeElement.scrollLeft;
    }
  }
  
  protected activeStageIndex: number = 0;
  protected realR32Teams = new Set<string>();

  protected setActiveStage(index: number): void {
    this.activeStageIndex = index;
    this.cdr.detectChanges();
  }

  private isAdvancedTeamsSet: boolean = false;

  private predictionTeams: any[] = [];
  private dbMatches: any[] = [];

  protected bestEightThirds: any[] = [];
  protected assignedThirds: any[] = [];

  // Dynamic handler setter mapping input array of 32 elements down into sequential pairs
  @Input() set setupAdvancedTeams(teams: any[] | null) {
    if (teams && teams.length === 32) {
      this.predictionTeams = teams;
      this.isAdvancedTeamsSet = true;
      this.assignedThirds = []; // Reset on new predictions to trigger backtrack
      this.pairTeamsFromPredictionsAndMatches();
    }
  }

  private pairTeamsFromPredictionsAndMatches(): void {
    if (!this.dbMatches || this.dbMatches.length === 0 || !this.predictionTeams || this.predictionTeams.length === 0) {
      return;
    }

    const standings: { [key: string]: any[] } = {};
    this.predictionTeams.forEach(t => {
      let grp = t.group || 'Group A';
      if (!grp.startsWith('Group ')) {
        grp = `Group ${grp}`;
      }
      if (!standings[grp]) standings[grp] = [];
      standings[grp].push(t);
    });

    Object.keys(standings).forEach(grp => {
      standings[grp].sort((a, b) => a.rankIndex - b.rankIndex);
    });

    const getTeamByRank = (groupLetter: string, rankIndex: number): any => {
      const grp = standings[`Group ${groupLetter}`];
      if (grp) {
        const found = grp.find(t => t.rankIndex === rankIndex);
        if (found) {
          return {
            name: found.name,
            group: `Group ${groupLetter}`,
            rank: rankIndex === 0 ? `Group ${groupLetter} Winner` : (rankIndex === 1 ? `Group ${groupLetter} Runner-up` : `Best 3rd Place (Group ${groupLetter})`),
            flagUrl: found.flagUrl,
            flagId: found.flagId
          };
        }
      }
      return null;
    };

    const hasAssignedThirds = this.assignedThirds && this.assignedThirds.length === 8 && this.assignedThirds.every(t => t);
    if (!hasAssignedThirds) {
      this.bestEightThirds = this.predictionTeams.filter(t => t.rankIndex === 2);
      while (this.bestEightThirds.length < 8) {
        this.bestEightThirds.push({
          name: 'À déterminer',
          group: '',
          flagUrl: 'assets/flags/unknown.png',
          flagId: 'tbc',
          rankIndex: 2
        });
      }

      this.assignedThirds = new Array(8);
      const slotWinners = ['Group E', 'Group I', 'Group A', 'Group L', 'Group D', 'Group G', 'Group B', 'Group K'];
      const used = new Set<number>();

      const backtrack = (winnerIndex: number): boolean => {
        if (winnerIndex === 8) return true;
        const wGroup = slotWinners[winnerIndex];
        for (let i = 0; i < 8; i++) {
          if (!used.has(i)) {
            const third = this.bestEightThirds[i];
            if (third && third.group !== wGroup) {
              used.add(i);
              this.assignedThirds[winnerIndex] = third;
              if (backtrack(winnerIndex + 1)) return true;
              used.delete(i);
            }
          }
        }
        return false;
      };

      if (!backtrack(0)) {
        for (let i = 0; i < 8; i++) {
          this.assignedThirds[i] = this.bestEightThirds[i];
        }
      }
    }

    const r32Matches = this.dbMatches.filter(m => m.phase === 'Round of 32');

    const r32Order = [73, 75, 74, 77, 81, 82, 83, 84, 76, 78, 79, 80, 85, 87, 86, 88];
    r32Matches.sort((a, b) => {
      const idA = parseInt(a.id || a.game_id, 10);
      const idB = parseInt(b.id || b.game_id, 10);
      return r32Order.indexOf(idA) - r32Order.indexOf(idB);
    });

    const parsePlaceholder = (placeholder: string): { groupLetter: string, rankIndex: number } | null => {
      if (!placeholder) return null;
      const lower = placeholder.toLowerCase().trim();
      let groupLetter = '';
      const groupMatch = lower.match(/group\s+([a-l])/i) || lower.match(/gr\.\s*([a-l])/i) || lower.match(/\s([a-l])$/i) || lower.match(/\s([a-l])\s/i);
      if (groupMatch) {
        groupLetter = groupMatch[1].toUpperCase();
      }

      if (lower.includes('winner') || lower.includes('1er') || lower.includes('1st') || lower.includes('vainqueur')) {
        return { groupLetter, rankIndex: 0 };
      }
      if (lower.includes('runner-up') || lower.includes('runner up') || lower.includes('2nd') || lower.includes('2eme') || lower.includes('second')) {
        return { groupLetter, rankIndex: 1 };
      }
      if (lower.includes('3rd') || lower.includes('3eme') || lower.includes('third') || lower.includes('troisieme')) {
        return { groupLetter, rankIndex: 2 };
      }
      return null;
    };

    const mappedR32Teams: any[] = [];

    r32Matches.forEach((m) => {
      const getTeamForPlaceholder = (placeholder: string): any => {
        if (!placeholder) return null;
        const lower = placeholder.toLowerCase().trim();
        if (!lower.includes('group') && !lower.includes('winner') && !lower.includes('runner') && !lower.includes('3rd') && !lower.includes('determiner')) {
          const found = this.predictionTeams.find(t => t.name.toLowerCase() === lower);
          if (found) return found;
        }
        const parsed = parsePlaceholder(placeholder);
        if (parsed) {
          if (parsed.rankIndex === 2) {
            const id = parseInt(m.id || m.game_id, 10);
            let third = null;
            if (id === 74) third = this.assignedThirds[0];
            else if (id === 77) third = this.assignedThirds[1];
            else if (id === 79) third = this.assignedThirds[2];
            else if (id === 80) third = this.assignedThirds[3];
            else if (id === 81) third = this.assignedThirds[4];
            else if (id === 82) third = this.assignedThirds[5];
            else if (id === 85) third = this.assignedThirds[6];
            else if (id === 87) third = this.assignedThirds[7];

            if (third && third.name !== 'À déterminer') {
              return {
                name: third.name,
                group: third.group || '',
                rank: 'Best 3rd Place (' + (third.group || '') + ')',
                flagUrl: third.flagUrl,
                flagId: third.flagId
              };
            }
          } else {
            const team = getTeamByRank(parsed.groupLetter, parsed.rankIndex);
            if (team) return team;
          }
        }

        return {
          name: placeholder,
          group: '',
          rank: '',
          flagUrl: 'assets/flags/unknown.png',
          flagId: 'tbc'
        };
      };

      const teamA = getTeamForPlaceholder(m.team_a);
      const teamB = getTeamForPlaceholder(m.team_b);

      mappedR32Teams.push(teamA);
      mappedR32Teams.push(teamB);
    });

    if (mappedR32Teams.length === 32) {
      this.populateRoundOf32Pairs(mappedR32Teams);
    }
  }

  getThirdPlaceSlotIdx(mIdx: number, slot: number): number {
    if (this.isKnockoutPhase2) return -1;
    if (slot !== 2) return -1;
    const r32Order = [73, 75, 74, 77, 81, 82, 83, 84, 76, 78, 79, 80, 85, 87, 86, 88];
    if (this.dbMatches && this.dbMatches.length > 0) {
      const r32Matches = this.dbMatches.filter(m => m.phase === 'Round of 32');
      r32Matches.sort((a, b) => {
        const idA = parseInt(a.id || a.game_id, 10);
        const idB = parseInt(b.id || b.game_id, 10);
        return r32Order.indexOf(idA) - r32Order.indexOf(idB);
      });
      const match = r32Matches[mIdx - 1];
      if (match) {
        const id = parseInt(match.id || match.game_id, 10);
        if (id === 74) return 0;
        if (id === 77) return 1;
        if (id === 79) return 2;
        if (id === 80) return 3;
        if (id === 81) return 4;
        if (id === 82) return 5;
        if (id === 85) return 6;
        if (id === 87) return 7;
      }
    }
    if (mIdx === 1) return 0;
    if (mIdx === 2) return 1;
    if (mIdx === 7) return 4;
    if (mIdx === 8) return 5;
    if (mIdx === 11) return 2;
    if (mIdx === 12) return 3;
    if (mIdx === 15) return 6;
    if (mIdx === 16) return 7;
    return -1;
  }

  getThirdPlaceOptions(slotIdx: number): any[] {
    const slotOpponentGroups = ['Group E', 'Group I', 'Group A', 'Group L', 'Group D', 'Group G', 'Group B', 'Group K'];
    const forbiddenGroupForCurrent = slotOpponentGroups[slotIdx];
    const currentTeam = this.assignedThirds[slotIdx];
    if (!currentTeam) return [];

    let allowedGroups: string[] | null = null;
    if (this.dbMatches && this.dbMatches.length > 0) {
      const idMap = [74, 77, 79, 80, 81, 82, 85, 87];
      const matchId = idMap[slotIdx];
      const match = this.dbMatches.find(m => parseInt(m.id || m.game_id, 10) === matchId);
      if (match) {
        const placeholder = (match.team_b || '').includes('3rd') ? match.team_b : match.team_a;
        if (placeholder) {
          const matchLetters = placeholder.match(/\(([^)]+)\)/);
          if (matchLetters) {
            allowedGroups = matchLetters[1].split('/').map((g: string) => g.trim().toUpperCase());
          }
        }
      }
    }

    return this.bestEightThirds.filter(team => {
      let teamGrp = team.group || '';
      if (teamGrp && !teamGrp.startsWith('Group ')) teamGrp = `Group ${teamGrp}`;
      if (teamGrp === forbiddenGroupForCurrent) return false;

      let teamGrpLetter = '';
      if (teamGrp.startsWith('Group ')) {
        teamGrpLetter = teamGrp.replace('Group ', '').trim().toUpperCase();
      } else {
        teamGrpLetter = teamGrp.trim().toUpperCase();
      }
      if (allowedGroups && !allowedGroups.includes(teamGrpLetter)) {
        return false;
      }

      const otherSlotIdx = this.assignedThirds.findIndex(t => t && t.name === team.name);
      if (otherSlotIdx !== -1 && otherSlotIdx !== slotIdx) {
        const forbiddenGroupForOther = slotOpponentGroups[otherSlotIdx];
        let currentTeamGrp = currentTeam.group || '';
        if (currentTeamGrp && !currentTeamGrp.startsWith('Group ')) currentTeamGrp = `Group ${currentTeamGrp}`;
        if (currentTeamGrp === forbiddenGroupForOther) return false;
      }

      return true;
    });
  }

  onThirdPlaceSelected(slotIdx: number, teamName: string): void {
    const selectedTeam = this.bestEightThirds.find(t => t.name === teamName);
    if (!selectedTeam) return;

    const currentTeam = this.assignedThirds[slotIdx];
    const otherSlotIdx = this.assignedThirds.findIndex(t => t && t.name === selectedTeam.name);

    if (otherSlotIdx !== -1 && otherSlotIdx !== slotIdx) {
      this.assignedThirds[otherSlotIdx] = currentTeam;
    }
    this.assignedThirds[slotIdx] = selectedTeam;

    this.pairTeamsFromPredictionsAndMatches();
    this.cdr.detectChanges();
  }

  protected activeDropdownSlot: number | null = null;

  toggleDropdown(slotIdx: number, event: Event): void {
    event.stopPropagation();
    if (this.activeDropdownSlot === slotIdx) {
      this.activeDropdownSlot = null;
    } else {
      this.activeDropdownSlot = slotIdx;
    }
    this.cdr.detectChanges();
  }

  selectThirdPlaceTeam(slotIdx: number, team: any): void {
    this.onThirdPlaceSelected(slotIdx, team.name);
    this.activeDropdownSlot = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    this.activeDropdownSlot = null;
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

  private targetDate = new Date(2026, 5, 12, 22, 55, 0);
  private currentDate = new Date();
  protected jeuFermer: boolean = false;

  ngOnInit(): void {
    const checkDate = this.isKnockoutPhase2 
      ? new Date(2026, 5, 28, 23, 0, 0)
      : this.targetDate;

    if (this.currentDate < checkDate) {
      this.jeuFermer = false;
    } else {
      this.jeuFermer = true;
    }
    this.initializePlaceholders();
    this.resetSelections();

    forkJoin({
      matches: this.matchesService.getAllMatches(),
      flags: this.teamsService.getFlags(),
      bracketResult: this.bracketResultApiService.getBracketResult(),
      rules: this.gameRulesService.getGameRules()
    }).subscribe({
      next: ({ matches, flags, bracketResult, rules }) => {
        if (bracketResult && bracketResult.data && bracketResult.data.length > 0) {
          this.realResults = bracketResult.data[0];
        }
        if (rules && rules.elements) {
          const bracketEl = rules.elements.find((e: any) => e.id === 'jeu_bracket');
          if (bracketEl) {
            this.bracketRules = bracketEl.bareme_points;
          }
        }
        try {
          flags.forEach((f: any) => {
            if (f && f.name) {
              const key = this.normalizeName(f.name);
              this.flagMap.set(key, { url: f.flag_url || f.url || 'assets/flags/unknown.png', iso: (f.iso || f.iso_code || '').toLowerCase() });
            }
          });
        } catch {
          // ignore
        }

        this.dbMatches = matches;
        this.populateMatchDetails(matches);

        const r32 = matches.filter((m: any) => m.phase === 'Round of 32');
        const realR32Teams = new Set<string>();
        r32.forEach((m: any) => {
          if (m.team_a && !m.team_a.includes('Placeholder') && m.team_a !== 'À déterminer') realR32Teams.add(m.team_a.toLowerCase().trim());
          if (m.team_b && !m.team_b.includes('Placeholder') && m.team_b !== 'À déterminer') realR32Teams.add(m.team_b.toLowerCase().trim());
        });
        this.realR32Teams = realR32Teams;

        if (!this.isAdvancedTeamsSet) {
          const generatedR32Teams = this.bracketService.generateRoundOf32FromGroups(matches, flags);
          if (generatedR32Teams && generatedR32Teams.length === 32) {
            this.populateRoundOf32Pairs(generatedR32Teams);
          }
        } else {
          this.pairTeamsFromPredictionsAndMatches();
        }

        this.resolveSavedFlags();

        this.stateService.userState.subscribe({
          next: (user) => {
            this.currentUser = user.first_name ? user.first_name : '';
            this.$bracket = this.isKnockoutPhase2
              ? this.knockoutBracketService.getUserKnockoutBracket(this.currentUser)
              : this.bracketService.getUserBracket(this.currentUser);

            this.$bracket.subscribe({
              next: (data) => {
                if (data && Array.isArray(data) && data.length > 0) {
                  this.applySavedBracket(data[0]);
                } else if (this.jeuFermer) {
                  this.validated = true;
                }
              },
              error: () => {
                if (this.jeuFermer) {
                  this.validated = true;
                }
              }
            });
          }
        });
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
    const filterAndSort = (phase: string) => {
      const filtered = matches.filter(m => m.phase === phase);
      if (phase === 'Round of 32') {
        const r32Order = [73, 75, 74, 77, 81, 82, 83, 84, 76, 78, 79, 80, 85, 87, 86, 88];
        filtered.sort((a, b) => {
          const idA = parseInt(a.id || a.game_id, 10);
          const idB = parseInt(b.id || b.game_id, 10);
          return r32Order.indexOf(idA) - r32Order.indexOf(idB);
        });
        return filtered;
      }
      return filtered.sort((a, b) => parseInt(a.id || a.game_id, 10) - parseInt(b.id || b.game_id, 10));
    };

    const r32 = filterAndSort('Round of 32');
    r32.forEach((m, idx) => {
      const index = idx + 1;
      const key = `R32_m${index}`;
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
    });

    const r16 = filterAndSort('Round of 16');
    r16.forEach((m, idx) => {
      const index = idx + 1;
      const key = `R16_m${index}`;
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
    });

    const quarters = filterAndSort('Quarter-finals');
    quarters.forEach((m, idx) => {
      const index = idx + 1;
      const key = `R4_m${index}`;
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
    });

    const semis = filterAndSort('Semi-finals');
    semis.forEach((m, idx) => {
      const index = idx + 1;
      const key = `S_m${index}`;
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
    });

    const finalMatch = matches.find(m => m.phase === 'Final');
    if (finalMatch) {
      let datePart = '-';
      let timePart = '';
      if (finalMatch.date) {
        const formatted = this.formatMatchDate(finalMatch.date);
        datePart = formatted.date;
        timePart = formatted.time;
      }
      this.matchDetails['Final_f1'] = {
        date: datePart,
        time: timePart,
        stadium: finalMatch.stadium || 'Inconnu'
      };
    }

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

    if (payload.predictions_json && typeof payload.predictions_json === 'object') {
      payload = { ...payload, ...payload.predictions_json };
    }
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

    const hasRealTeams = extracted.some(t => t && t.name && t.name !== 'À déterminer');
    const hasCurrentRealTeams = Object.values(this.r32Teams).some(t => t && t.name && t.name !== 'À déterminer');

    if (extracted.length >= 32 && (hasRealTeams || !hasCurrentRealTeams)) {
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
    this.cdr.detectChanges();
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

    let payload: any = {
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

    if (this.isKnockoutPhase2) {
      // bracket_knockout collection stores: user (string), status, predictions_json (JSON object).
      // The JSON object uses the same flat keys as the bracket collection so match-results.mjs
      // can spread them via: { ...b, ...b.predictions_json } for scoring.
      const predictions_json: any = {};
      for (const key in payload) {
        if (key !== 'user' && key !== 'status') {
          predictions_json[key] = payload[key];
        }
      }
      payload = {
        user: payload.user,
        status: payload.status,
        predictions_json
      };
    }

    console.log('Payload to submit:', payload);
    if (this.isKnockoutPhase2) {
      console.log('Phase 2 JSON body:', JSON.stringify(payload));
    }

    const serviceCall = this.isKnockoutPhase2
      ? this.knockoutBracketService.postKnockoutBracket(payload)
      : this.bracketService.postBracket(payload);

    serviceCall.subscribe({
      next: () => {
        // take a snapshot of the current bracket to show as a read-only validated view
        this.takeValidatedSnapshot();
        this.validated = true;
        // refresh the page to reflect saved state
        window.location.reload();
      },
      error: (err) => {
        console.error('Validation error details:', err);
        const msg = err?.error?.errors?.[0]?.message
          || err?.error?.message
          || JSON.stringify(err?.error)
          || 'Unknown error';
        alert(`Erreur lors de la validation du pronostic.\n\nDirectus: ${msg}`);
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

  getMatchIdLabel(mIdx: number): string {
    const r32Order = [73, 75, 74, 77, 81, 82, 83, 84, 76, 78, 79, 80, 85, 87, 86, 88];
    if (this.dbMatches && this.dbMatches.length > 0) {
      const r32Matches = this.dbMatches.filter(m => m.phase === 'Round of 32');
      r32Matches.sort((a, b) => {
        const idA = parseInt(a.id || a.game_id, 10);
        const idB = parseInt(b.id || b.game_id, 10);
        return r32Order.indexOf(idA) - r32Order.indexOf(idB);
      });
      const match = r32Matches[mIdx - 1];
      if (match) {
        return 'M' + (match.id || match.game_id);
      }
    }
    return 'M' + r32Order[mIdx - 1];
  }

  getStageMatchIdLabel(stage: string, mIdx: number): string {
    if (stage === 'R32') {
      return this.getMatchIdLabel(mIdx);
    }
    if (this.dbMatches && this.dbMatches.length > 0) {
      let phaseName = '';
      if (stage === 'R16') phaseName = 'Round of 16';
      else if (stage === 'R4') phaseName = 'Quarter-finals';
      else if (stage === 'S') phaseName = 'Semi-finals';
      else if (stage === 'Final') phaseName = 'Final';

      const phaseMatches = this.dbMatches.filter(m => m.phase === phaseName);
      phaseMatches.sort((a, b) => parseInt(a.id || a.game_id, 10) - parseInt(b.id || b.game_id, 10));
      const match = phaseMatches[mIdx - 1];
      if (match) {
        return 'M' + (match.id || match.game_id);
      }
    }
    if (stage === 'R16') return 'M' + (88 + mIdx);
    if (stage === 'R4') return 'M' + (96 + mIdx);
    if (stage === 'S') return 'M' + (100 + mIdx);
    if (stage === 'Final') return 'M104';
    return '';
  }

  protected realResults: any = null;
  protected bracketRules: any = null;

  getPredictionEvaluation(stage: string, matchKey: string): { 
    status: 'correct' | 'incorrect' | 'pending', 
    points: number, 
    realWinnerName?: string, 
    realWinnerFlagUrl?: string,
    realTeamAName?: string,
    realTeamBName?: string,
    realTeamAFlagUrl?: string,
    realTeamBFlagUrl?: string
  } {
    let realTeamAName = '';
    let realTeamBName = '';
    let realTeamAFlagUrl = '';
    let realTeamBFlagUrl = '';

    if (this.dbMatches && this.dbMatches.length > 0) {
      let phaseName = '';
      let mIdx = stage === 'Final' ? 1 : parseInt(matchKey.replace(/\D/g, ''), 10);
      if (stage === 'R32') phaseName = 'Round of 32';
      else if (stage === 'R16') phaseName = 'Round of 16';
      else if (stage === 'R4') phaseName = 'Quarter-finals';
      else if (stage === 'S') phaseName = 'Semi-finals';
      else if (stage === 'Final') phaseName = 'Final';

      const phaseMatches = this.dbMatches.filter(m => m.phase === phaseName);
      if (stage === 'R32') {
        const r32Order = [73, 75, 74, 77, 81, 82, 83, 84, 76, 78, 79, 80, 85, 87, 86, 88];
        phaseMatches.sort((a, b) => {
          const idA = parseInt(a.id || a.game_id, 10);
          const idB = parseInt(b.id || b.game_id, 10);
          return r32Order.indexOf(idA) - r32Order.indexOf(idB);
        });
      } else {
        phaseMatches.sort((a, b) => parseInt(a.id || a.game_id, 10) - parseInt(b.id || b.game_id, 10));
      }

      const match = phaseMatches[mIdx - 1];
      if (match) {
        const isPlaceholder = (name: string) => {
          if (!name) return true;
          const lower = name.toLowerCase();
          return lower.includes('winner') || lower.includes('runner') || lower.includes('3rd') || lower.includes('determiner') || lower.includes('group');
        };

        if (match.team_a && !isPlaceholder(match.team_a)) {
          realTeamAName = match.team_a;
          const c = this.mapNameToCountry(match.team_a);
          realTeamAFlagUrl = c?.flagUrl || 'assets/flags/unknown.png';
        }
        if (match.team_b && !isPlaceholder(match.team_b)) {
          realTeamBName = match.team_b;
          const c = this.mapNameToCountry(match.team_b);
          realTeamBFlagUrl = c?.flagUrl || 'assets/flags/unknown.png';
        }
      }
    }

    const baseResult = {
      realTeamAName: realTeamAName || undefined,
      realTeamBName: realTeamBName || undefined,
      realTeamAFlagUrl: realTeamAFlagUrl || undefined,
      realTeamBFlagUrl: realTeamBFlagUrl || undefined
    };

    if (!this.validated || !this.realResults) {
      return { status: 'pending', points: 0, ...baseResult };
    }

    let resultKey = '';
    let pts = 0;

    const r32Pts = this.bracketRules?.['32eme_de_finale'] ?? 20;
    const r16Pts = this.bracketRules?.['16eme_de_finale'] ?? 40;
    const qfPts = this.bracketRules?.['8eme_de_finale'] ?? 60;
    const sfPts = this.bracketRules?.['demi_finale'] ?? 75;
    const fPts = this.bracketRules?.['finale'] ?? 150;

    if (stage === 'R32') {
      const idx = matchKey.replace('m', '');
      resultKey = `winner_r32_${idx}`;
      pts = r32Pts;
    } else if (stage === 'R16') {
      const idx = matchKey.replace('m', '');
      resultKey = `winner_r16_${idx}`;
      pts = r16Pts;
    } else if (stage === 'R4') {
      const idx = matchKey.replace('m', '');
      resultKey = `winner_r4_${idx}`;
      pts = qfPts;
    } else if (stage === 'S') {
      const idx = matchKey.replace('m', '');
      resultKey = `winner_semi_${idx}`;
      pts = sfPts;
    } else if (stage === 'Final') {
      resultKey = 'winner_wc';
      pts = fPts;
    }

    const predicted = this.getWinner(stage, matchKey)?.name;
    const real = this.realResults[resultKey];

    if (!real || real === 'À déterminer') {
      return { status: 'pending', points: 0, ...baseResult };
    }

    if (!predicted || predicted === 'À déterminer') {
      const realCountry = this.mapNameToCountry(real);
      const realWinnerFlagUrl = realCountry?.flagUrl || 'assets/flags/unknown.png';
      return { status: 'incorrect', points: 0, realWinnerName: real, realWinnerFlagUrl, ...baseResult };
    }

    const isCorrect = predicted.toLowerCase().trim() === real.toLowerCase().trim();
    const isCorrectFuzzy = this.normalizeName(predicted) === this.normalizeName(real);

    const realCountry = this.mapNameToCountry(real);
    const realWinnerFlagUrl = realCountry?.flagUrl || 'assets/flags/unknown.png';

    if (isCorrect || isCorrectFuzzy) {
      return { status: 'correct', points: pts, realWinnerName: real, realWinnerFlagUrl, ...baseResult };
    } else {
      return { status: 'incorrect', points: 0, realWinnerName: real, realWinnerFlagUrl, ...baseResult };
    }
  }
}