import { Component, inject, OnInit } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { StateService } from '../../../shared/services/core/state.service';
import { BracketService } from '../../../shared/services/games/bracket.service';

@Component({
  selector: 'app-bracket-challenge',
  templateUrl: './bracket-challenge.component.html',
  styleUrl: './bracket-challenge.component.scss'
})
export class BracketChallengeComponent implements OnInit {
  private cookieService = inject(CookieService);
  private bracketService = inject(BracketService);
  private stateService = inject(StateService);
  
  protected activeWizardStep: 'groups' | 'knockout' = 'groups';
  protected advancedQualifiers: any[] = [];
  protected isLoggedIn: boolean = false;

  ngOnInit(): void {
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
    this.advancedQualifiers = qualifiedTeams;
    this.activeWizardStep = 'knockout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToGroups(): void {
    this.activeWizardStep = 'groups';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
