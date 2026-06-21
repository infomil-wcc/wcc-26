import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { StateService } from '../../../shared/services/core/state.service';
import { BracketService } from '../../../shared/services/games/bracket.service';
import { BracketPredictorComponent } from '../bracket-predictor/bracket-predictor.component';
import { BracketKnockoutComponent } from '../bracket-knockout/bracket-knockout.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LoginComponent } from '../../../shared/components/login/login.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';

@Component({
    selector: 'app-bracket-challenge',
    templateUrl: './bracket-challenge.component.html',
    styleUrl: './bracket-challenge.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [BracketPredictorComponent, BracketKnockoutComponent, ModalComponent, LoginComponent, DialogComponent]
})
export class BracketChallengeComponent implements OnInit {
  private cookieService = inject(CookieService);
  private bracketService = inject(BracketService);
  private stateService = inject(StateService);

  private targetDate = new Date(2026, 5, 12, 22, 55, 0);
  private currentDate = new Date();
  
  protected activeWizardStep: 'groups' | 'knockout' = 'groups';
  protected advancedQualifiers: any[] = [];
  protected isLoggedIn: boolean = false;
  protected hasSavedBracket: boolean = false;
  private savedBracketId: string | null = null;
  protected showDeleteDialog: boolean = false;
  protected deleteDialogMode: 'confirm' | 'info' = 'confirm';
  protected deleteDialogMessage: string = '';
  protected jeuFermer: boolean = false;

  ngOnInit(): void {
    if (this.currentDate < this.targetDate) {
      this.jeuFermer = false;
    }
    else {
      this.jeuFermer = true;
    }

    // prefer application user state (first_name) to find saved bracket
    this.stateService.userState.subscribe({
      next: (user) => {
        const firstName = user.first_name ?? '';
        if (firstName) {
          this.isLoggedIn = true;
          this.bracketService.getUserBracket(firstName).subscribe({
            next: (data) => {
              if (data && Array.isArray(data) && data.length > 0) {
                // user already has a saved bracket — try to reconstruct full 32-team qualifiers from payload
                const payload = data[0] || {};
                // mark that user has a saved bracket and keep its id for potential deletion
                this.hasSavedBracket = true;
                this.savedBracketId = payload?.id || null;

                  console.log('Found saved bracket for user', firstName, 'with payload:', payload);
                
                  const extracted: any[] = [];

                    // 1) If payload exposes an array named 'r32' or 'teams32' or 'advancedQualifiers', use it
                    if (Array.isArray(payload.r32) && payload.r32.length >= 32) {
                      extracted.push(...payload.r32.slice(0,32));
                    } else if (Array.isArray(payload.teams32) && payload.teams32.length >= 32) {
                      extracted.push(...payload.teams32.slice(0,32));
                    } else if (Array.isArray(payload.advancedQualifiers) && payload.advancedQualifiers.length >= 32) {
                      extracted.push(...payload.advancedQualifiers.slice(0,32));
                    } else {
                      // 2) Try explicit per-match keys: r32_1_1 / r32_1_2 etc.
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
                          if (typeof raw === 'string') return { name: raw, flagUrl: raw.includes('assets') ? raw : 'assets/flags/unknown.png', flagId: raw.substring(0,2).toLowerCase() };
                          if (raw.name) return raw;
                          return null;
                        }

                        const left = normalize(leftRaw);
                        const right = normalize(rightRaw);
                        if (left) extracted.push(left); else extracted.push({ name: 'À déterminer', flagUrl: 'assets/flags/unknown.png', flagId: 'tbc' });
                        if (right) extracted.push(right); else extracted.push({ name: 'À déterminer', flagUrl: 'assets/flags/unknown.png', flagId: 'tbc' });
                      }
                    }

                    // if we managed to extract 32 items, use them
                    if (extracted.length >= 32) {
                      this.advancedQualifiers = extracted.slice(0,32);
                    } else {
                      // fallback: if we only have winner_r32_1..16, place each winner in the first slot of its match and a placeholder as opponent
                      const winners: any[] = [];
                      let foundWinner = false;
                      for (let i = 1; i <= 16; i++) {
                        const w = payload[`winner_r32_${i}`];
                        if (w) {
                          foundWinner = true;
                          winners.push({ name: w, flagUrl: 'assets/flags/unknown.png', flagId: w.substring(0,2).toLowerCase() });
                          winners.push({ name: 'À déterminer', flagUrl: 'assets/flags/unknown.png', flagId: 'tbc' });
                        }
                      }
                      if (foundWinner && winners.length === 32) {
                        this.advancedQualifiers = winners;
                      }
                      // mark that user has a saved bracket and keep its id for potential deletion
                      this.hasSavedBracket = true;
                      this.savedBracketId = payload?.id || (data[0] && data[0].id) || null;
                    }

                    // Only allow moving to knockout if the bracket is not closed for registered users
                    if (this.jeuFermer && this.isLoggedIn) {
                      this.deleteDialogMode = 'info';
                      this.deleteDialogMessage = 'Le bracket est fermé. Vous ne pouvez plus jouer.';
                      this.showDeleteDialog = true;
                      // this.activeWizardStep = 'knockout';
                    }
                    this.activeWizardStep = 'knockout';
                  }
            },
            error: () => {
              // ignore get errors
            }
          });
        } else {
          this.isLoggedIn = false;
        }
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

  deleteBracket(): void {
    if (!this.savedBracketId) {
      this.deleteDialogMode = 'info';
      this.deleteDialogMessage = 'Aucun bracket trouvé à réinitialiser.';
      this.showDeleteDialog = true;
      return;
    }
    // show confirmation dialog
    this.deleteDialogMode = 'confirm';
    this.deleteDialogMessage = 'Voulez-vous vraiment réinitialiser votre bracket ? Cette action est irréversible.';
    this.showDeleteDialog = true;
  }

  onDeleteConfirmed(): void {
    if (!this.savedBracketId) {
      this.deleteDialogMode = 'info';
      this.deleteDialogMessage = 'Aucun bracket trouvé à réinitialiser.';
      return;
    }
    // perform delete
    this.bracketService.deleteBracket(this.savedBracketId).subscribe({
      next: () => {
        this.hasSavedBracket = false;
        this.savedBracketId = null;
        this.advancedQualifiers = [];
        this.activeWizardStep = 'groups';
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
