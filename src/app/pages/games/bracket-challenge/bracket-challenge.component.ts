import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { CookieService } from '../../../core/services/core/cookie.service';
import { StateService } from '../../../core/services/core/state.service';
import { BracketService } from '../../../core/services/games/bracket.service';
import { BracketPredictorComponent } from '../bracket-predictor/bracket-predictor.component';
import { BracketKnockoutComponent } from '../bracket-knockout/bracket-knockout.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LoginComponent } from '../../../shared/components/login/login.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { RankingsService } from '../../../core/services/content/rankings.service';
import { MatchesService } from '../../../core/services/content/matches.service';
import { TeamsService } from '../../../core/services/content/teams.service';
import { KnockoutBracketService } from '../../../core/services/games/knockout-bracket.service';
import { PredictionsApiService } from '../../../core/services/api/predictions-api.service';

@Component({
    selector: 'app-bracket-challenge',
    templateUrl: './bracket-challenge.component.html',
    styleUrl: './bracket-challenge.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BracketPredictorComponent, BracketKnockoutComponent, ModalComponent, LoginComponent, DialogComponent, AsyncPipe, CommonModule]
})
export class BracketChallengeComponent implements OnInit {
  private cookieService = inject(CookieService);
  private bracketService = inject(BracketService);
  private stateService = inject(StateService);
  private rankingsService = inject(RankingsService);
  private matchesService = inject(MatchesService);
  private teamsService = inject(TeamsService);
  private knockoutBracketService = inject(KnockoutBracketService);
  private predictionsApiService = inject(PredictionsApiService);

  protected bracketPoints$!: Observable<{ value: number } | null>;

  private targetDate = new Date(2026, 5, 12, 22, 55, 0);
  private currentDate = new Date();
  
  protected activeWizardStep: 'groups' | 'knockout' = 'groups';
  protected advancedQualifiers: any[] = [];
  protected realKnockoutQualifiers: any[] = [];
  protected isLoggedIn: boolean = false;
  protected hasSavedBracket: boolean = false;
  private savedBracketId: string | null = null;
  
  protected hasSavedKnockoutBracket: boolean = false;
  protected savedKnockoutBracketId: string | null = null;
  
  protected showDeleteDialog: boolean = false;
  protected deleteDialogMode: 'confirm' | 'info' = 'confirm';
  protected deleteDialogMessage: string = '';
  protected jeuFermer: boolean = false;
  protected knockoutJeuFermer: boolean = false;
  protected currentPhase: 1 | 2 = 1;
  protected showKnockoutPromptDialog: boolean = false;

  ngOnInit(): void {
    this.bracketPoints$ = this.stateService.userState.pipe(
      switchMap(user => {
        if (!user?.id || !user?.last_name) return of(null);
        return this.rankingsService.getBracketRankings().pipe(
          map(res => {
            const list = res?.[0]?.ranking_json || [];
            const userRank = list.find((item: any) => (item.user || '').toLowerCase().trim() === (user.last_name || '').toLowerCase().trim());
            if (userRank) {
              return { value: Number(userRank.point) || 0 };
            }
            return { value: 0 };
          }),
          catchError(() => of({ value: 0 }))
        );
      })
    );

    if (this.currentDate < this.targetDate) {
      this.jeuFermer = false;
    } else {
      this.jeuFermer = true;
    }

    // 1. Fetch matches and flags first
    forkJoin({
      matches: this.matchesService.getAllMatches(),
      flags: this.teamsService.getFlags()
    }).subscribe({
      next: ({ matches, flags }) => {
        // Derive knockoutJeuFermer dynamically from the first R32 match kickoff
        const r32Matches = matches
          .filter(m => m.phase === 'Round of 32' && m.date)
          .map(m => new Date(m.date))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        const firstR32Kickoff = r32Matches.length > 0 ? r32Matches[0] : null;
        this.knockoutJeuFermer = firstR32Kickoff ? this.currentDate >= firstR32Kickoff : false;

        this.realKnockoutQualifiers = this.bracketService.generateRoundOf32FromGroups(matches, flags);

        // 2. Once matches & flags are ready, subscribe to userState and load user brackets
        this.stateService.userState.subscribe({
          next: (user) => {
            const firstName = user.first_name ?? '';
            if (firstName) {
              this.isLoggedIn = true;

              // Load Phase 1 Bracket
              this.bracketService.getUserBracket(firstName).subscribe({
                next: (data) => {
                  if (data && Array.isArray(data) && data.length > 0) {
                    const payload = data[0] || {};
                    this.hasSavedBracket = true;
                    this.savedBracketId = payload?.id || null;

                    console.log('Found saved Phase 1 bracket for user', firstName, 'with payload:', payload);
                    const extracted: any[] = [];

                    // Reconstruct from predictions_json if present
                    const pSource = (payload.predictions_json && typeof payload.predictions_json === 'object')
                      ? { ...payload, ...payload.predictions_json }
                      : payload;

                    if (Array.isArray(pSource.r32) && pSource.r32.length >= 32) {
                      extracted.push(...pSource.r32.slice(0, 32));
                    } else if (Array.isArray(pSource.teams32) && pSource.teams32.length >= 32) {
                      extracted.push(...pSource.teams32.slice(0, 32));
                    } else if (Array.isArray(pSource.advancedQualifiers) && pSource.advancedQualifiers.length >= 32) {
                      extracted.push(...pSource.advancedQualifiers.slice(0, 32));
                    } else {
                      for (let i = 1; i <= 16; i++) {
                        const candidatesLeft = [
                          pSource[`r32_${i}_1`], pSource[`r32_${i}1`], pSource[`team_r32_${i}_1`], pSource[`m${i}_1`]
                        ];
                        const candidatesRight = [
                          pSource[`r32_${i}_2`], pSource[`r32_${i}2`], pSource[`team_r32_${i}_2`], pSource[`m${i}_2`]
                        ];
                        const leftRaw = candidatesLeft.find(v => v !== undefined && v !== null);
                        const rightRaw = candidatesRight.find(v => v !== undefined && v !== null);

                        const normalize = (raw: any) => {
                          if (!raw) return null;
                          if (typeof raw === 'string') return { name: raw, flagUrl: raw.includes('assets') ? raw : 'assets/flags/unknown.png', flagId: raw.substring(0, 2).toLowerCase() };
                          if (raw.name) return raw;
                          return null;
                        }

                        const left = normalize(leftRaw);
                        const right = normalize(rightRaw);
                        if (left) extracted.push(left);
                        if (right) extracted.push(right);
                      }
                    }

                    // Fallback to real qualified teams if we don't have predictions or they are empty
                    const hasValidTeams = extracted.length >= 32 && extracted.every(t => t && t.name && t.name !== 'À déterminer');
                    if (hasValidTeams) {
                      this.advancedQualifiers = extracted.slice(0, 32);
                    } else {
                      this.advancedQualifiers = this.realKnockoutQualifiers;
                    }

                    if (this.jeuFermer) {
                      // Phase 1 is closed - keep read-only knockout step active
                      this.activeWizardStep = 'knockout';
                    }
                  }
                }
              });

              // Load Phase 2 Bracket
              this.knockoutBracketService.getUserKnockoutBracket(firstName).subscribe({
                next: (data) => {
                  if (data && Array.isArray(data) && data.length > 0) {
                    const payload = data[0] || {};
                    this.hasSavedKnockoutBracket = true;
                    this.savedKnockoutBracketId = payload?.id || null;
                  } else {
                    // Not saved yet, trigger popup prompt if game is open
                    if (!this.knockoutJeuFermer) {
                      this.showKnockoutPromptDialog = true;
                    }
                  }
                }
              });

            } else {
              this.isLoggedIn = false;
            }
          }
        });
      }
    });


  }

  handleGroupPredictionsFinished(qualifiedTeams: any[]): void {
    // prevent registered users from proceeding if the game is closed
    if (this.jeuFermer && this.isLoggedIn) {
      this.deleteDialogMode = 'info';
      this.deleteDialogMessage = 'Le bracket est fermé. Vous ne pouvez plus jouer.';
      this.showDeleteDialog = true;
      return;
    }

    this.advancedQualifiers = qualifiedTeams;
    this.activeWizardStep = 'knockout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToGroups(): void {
    this.activeWizardStep = 'groups';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setPhase(phase: 1 | 2): void {
    this.currentPhase = phase;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeKnockoutPromptDialog(): void {
    this.showKnockoutPromptDialog = false;
  }

  playKnockoutPhase2(): void {
    this.showKnockoutPromptDialog = false;
    this.currentPhase = 2;
    this.activeWizardStep = 'knockout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteBracket(): void {
    const id = this.currentPhase === 1 ? this.savedBracketId : this.savedKnockoutBracketId;
    if (!id) {
      this.deleteDialogMode = 'info';
      this.deleteDialogMessage = 'Aucun bracket trouvé à réinitialiser.';
      this.showDeleteDialog = true;
      return;
    }
    // show confirmation dialog
    this.deleteDialogMode = 'confirm';
    this.deleteDialogMessage = this.currentPhase === 1 
      ? 'Voulez-vous vraiment réinitialiser votre bracket ? Cette action est irréversible.'
      : 'Voulez-vous vraiment réinitialiser votre bracket de la Phase Finale ? Cette action est irréversible.';
    this.showDeleteDialog = true;
  }

  onDeleteConfirmed(): void {
    const id = this.currentPhase === 1 ? this.savedBracketId : this.savedKnockoutBracketId;
    if (!id) {
      this.deleteDialogMode = 'info';
      this.deleteDialogMessage = 'Aucun bracket trouvé à réinitialiser.';
      return;
    }
    
    const serviceCall = this.currentPhase === 1 
      ? this.bracketService.deleteBracket(id)
      : this.knockoutBracketService.deleteKnockoutBracket(id);

    serviceCall.subscribe({
      next: () => {
        if (this.currentPhase === 1) {
          this.hasSavedBracket = false;
          this.savedBracketId = null;
          this.advancedQualifiers = [];
          this.activeWizardStep = 'groups';
        } else {
          this.hasSavedKnockoutBracket = false;
          this.savedKnockoutBracketId = null;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.deleteDialogMode = 'info';
        this.deleteDialogMessage = 'Bracket réinitialisé.';
        this.showDeleteDialog = true; // keep dialog open to show message
      },
      error: () => {
        this.deleteDialogMode = 'info';
        this.deleteDialogMessage = 'Erreur lors de la réinitialisation du bracket.';
        this.showDeleteDialog = true;
      }
    });
  }

  onDeleteDialogClose(): void {
    this.showDeleteDialog = false;
  }
}
