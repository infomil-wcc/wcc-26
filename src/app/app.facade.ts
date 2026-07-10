import { Injectable, inject, signal, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { AuthService } from './core/services/core/auth.service';
import { CookieService } from './core/services/core/cookie.service';
import { StateService, user } from './core/services/core/state.service';
import { TotalgoalsService } from './core/services/core/total-goals.service';
import { KnockoutBracketService } from './core/services/games/knockout-bracket.service';
import { MatchesService } from './core/services/content/matches.service';
import { AppUpdateService } from './core/services/core/app-update.service';

import { AUTH_COOKIE_KEYS, getEarliestMatchDate, hasKickoffPassed } from './app.utils';

@Injectable()
export class AppFacade {

  // ── Core services ─────────────────────────────────────────────────────────
  private readonly router                 = inject(Router);
  private readonly authService            = inject(AuthService);
  private readonly stateService           = inject(StateService);
  private readonly cookieService          = inject(CookieService);
  private readonly totalgoalsService      = inject(TotalgoalsService);
  private readonly knockoutBracketService = inject(KnockoutBracketService);
  private readonly matchesService         = inject(MatchesService);
  private readonly formBuilder            = inject(FormBuilder);
  readonly appUpdate                      = inject(AppUpdateService);

  // ── Signals (UI state) ────────────────────────────────────────────────────
  readonly showLoader               = signal(true);
  readonly showDialog               = signal(false);
  readonly showKnockoutPhase2Dialog = signal(false);

  // ── Internal state ────────────────────────────────────────────────────────
  private cookieToken = '';
  private cookieUser  = '';
  private currentUser!: user;

  // ── Forms ─────────────────────────────────────────────────────────────────
  readonly goalsForm: FormGroup = this.formBuilder.group({
    totalGoalsPrediction: ['', [Validators.required, Validators.min(0)]],
  });

  // ── Initialisation ────────────────────────────────────────────────────────
  init(): void {
    this.cookieToken = this.cookieService.get('currentToken');
    this.cookieUser  = this.cookieService.get('currentUser');

    if (this.cookieToken && this.cookieUser) {
      this.handleAlreadyLogged();
    } else {
      this.showLoader.set(false);
    }

    this.stateService.userState.subscribe({
      next: (res: user) => {
        this.currentUser = res;
        if (res.first_name) {
          this.checkKnockoutPhase2(res.first_name);
        } else {
          // Guest: show phase 2 popup only before kick-off
          this.getFirstR32KickoffTime().subscribe(kickoff => {
            if (kickoff && !hasKickoffPassed(kickoff)) {
              this.showKnockoutPhase2Dialog.set(true);
            }
          });
        }
      },
    });
  }

  // ── Auth flow ─────────────────────────────────────────────────────────────
  private handleAlreadyLogged(): void {
    this.authService.tryRefreshToken(this.cookieToken)
      .pipe(
        catchError((err: unknown) => {
          this.showLoader.set(false);
          return this.handleAuthError(err);
        }),
      )
      .subscribe({
        next: (res: any) => {
          if (res?.data?.token) {
            this.authService.setTokenCookie(res.data.token);
            this.cookieToken = res.data.token;
          }
          this.authService.getUserInfos(this.cookieUser, this.cookieToken).subscribe({
            next: (resUser: any) => {
              if (resUser?.data) {
                this.stateService.updateUser(resUser.data);
                this.checkTotalGoals(this.currentUser.last_name ?? '');
              }
              this.showLoader.set(false);
            },
            error: () => this.showLoader.set(false),
          });
        },
        error: () => this.showLoader.set(false),
      });
  }

  private handleAuthError(err: unknown): Observable<Response> {
    const e = err as any;
    if (e?.error?.error?.message) {
      console.clear();
      AUTH_COOKIE_KEYS.forEach(key => this.cookieService.delete(key));
    }
    return throwError(() => err);
  }

  // ── Total goals dialog ────────────────────────────────────────────────────
  private checkTotalGoals(lastName: string): void {
    this.totalgoalsService.hasTotalGoals(lastName).subscribe({
      next: (res: any[]) => {
        if (res.length < 1) this.showDialog.set(true);
      },
      error: (err: unknown) => console.error(err),
    });
  }

  submitGoals(): void {
    if (!this.currentUser) return;
    const lastName = this.currentUser.last_name ?? '';
    this.totalgoalsService
      .submitGoals(lastName, this.goalsForm.value.totalGoalsPrediction, this.cookieToken)
      .subscribe({
        next: () => this.showDialog.set(false),
        error: (err: unknown) => console.error(err),
      });
  }

  closeGoalsDialog(): void {
    this.showDialog.set(false);
  }

  // ── Knockout phase 2 popup ────────────────────────────────────────────────
  private getFirstR32KickoffTime(): Observable<Date | null> {
    const injector = inject(Injector);
    return toObservable(this.matchesService.getMatchesByPhase('Round of 32'), { injector }).pipe(
      switchMap((matches: any[]) => of(getEarliestMatchDate(matches))),
      catchError(() => of(null)),
    );
  }

  private checkKnockoutPhase2(userFirstName: string): void {
    if (!userFirstName) return;
    this.getFirstR32KickoffTime()
      .pipe(
        switchMap((kickoff: Date | null) => {
          if (hasKickoffPassed(kickoff)) {
            this.showKnockoutPhase2Dialog.set(false);
            return of(null);
          }
          return this.knockoutBracketService.getUserKnockoutBracket(userFirstName);
        }),
        catchError(() => of(null)),
      )
      .subscribe({
        next: (data: any) => {
          if (data === null) return;
          this.showKnockoutPhase2Dialog.set(!data || data.length === 0);
        },
        error: () => this.showKnockoutPhase2Dialog.set(false),
      });
  }

  goToBracketChallenge(): void {
    this.showKnockoutPhase2Dialog.set(false);
    this.router.navigate(['/bracket-challenge']);
  }

  closeKnockoutPhase2Dialog(): void {
    this.showKnockoutPhase2Dialog.set(false);
  }
}
