import { Component, Input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { StateService, AppState, user } from './core/services/core/state.service';
import { AuthService } from './core/services/core/auth.service';
import { TeamsService } from './core/services/content/teams.service';
import { CookieService } from './core/services/core/cookie.service';
import { Observable, catchError, switchMap, of, throwError } from 'rxjs';
import { TotalgoalsService } from './core/services/core/total-goals.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LayoutComponent } from './shared/components/layout/layout.component';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { MenuComponent } from './shared/components/menu/menu.component';
import { HeroComponent } from './shared/components/hero/hero.component';
import { HpNewsComponent } from './features/homepage/components/news/news.component';
import { FaqComponent } from './features/faq/pages/faq.component';
import { GameRulesComponent } from './features/game-rules/pages/game-rules.component';
import { GroupStandingsComponent } from './features/competition/group-standings/pages/group-standings.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { DialogComponent } from './shared/components/dialog/dialog.component';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { ModalComponent } from './shared/components/modal/modal.component';
import { AppUpdateService } from './core/services/core/app-update.service';
import { KnockoutBracketService } from './core/services/games/knockout-bracket.service';
import { MatchesService } from './core/services/content/matches.service';
import { ThemeService } from './core/services/theme.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LayoutComponent, MenuComponent, HeroComponent, HpNewsComponent, RouterOutlet, FooterComponent, DialogComponent, ReactiveFormsModule, LoaderComponent, ModalComponent]
})
export class AppComponent implements OnInit {

  public appUpdate = inject(AppUpdateService);
  private knockoutBracketService = inject(KnockoutBracketService);
  private matchesService = inject(MatchesService);
  
  @Input() showLoader: boolean = true;
  public title: string = 'IML Foot Challenge - FIFA WORLD CUP 2026';
  public page: number = 0;
  public showDialog: boolean = false;
  public showKnockoutPhase2Dialog: boolean = false;

  private cookieToken!: string;
  private cookieUser!: string;
  private currentUser!: user;
  protected goalsForm!: FormGroup;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private stateService: StateService,
    private euroService: TeamsService,
    private authService: AuthService,
    private totalgoalsService: TotalgoalsService,
    private cookieService: CookieService,
    private formBuilder: FormBuilder,
    private themeService: ThemeService
  ){}

  ngOnInit(): void {
    this.goalsForm = this.formBuilder.group({
      totalGoalsPrediction: ['', [Validators.required, Validators.min(0)]]
    });

    this.cookieToken = this.cookieService.get('currentToken');
    this.cookieUser = this.cookieService.get('currentUser');

    if(this.cookieToken !== '' && this.cookieUser !== ''){
      this.handleAlreadylogged();
    } else {
      this.showLoader = false;
    }

    this.stateService.userState.subscribe({
      next:(res) => {
        this.currentUser = res;
        if (res.first_name) {
          this.checkKnockoutPhase2(res.first_name);
        } else {
          // Guest user: show popup only if the first R32 match has not kicked off yet
          this.getFirstR32KickoffTime().subscribe(kickoff => {
            if (kickoff && new Date() < kickoff) {
              this.showKnockoutPhase2Dialog = true;
            }
          });
        }
      }
    });

  }

  handleAlreadylogged(): void {
    this.authService.tryRefreshToken(this.cookieToken)
    .pipe(
      catchError(err => {
        this.showLoader = false;
        return this.handleError(err);
      })
    )
    .subscribe({
      next: (res: any) => {
        if (res && res.data && res.data.token) {
          this.authService.setTokenCookie(res.data.token);
          this.cookieToken = res.data.token;
        }
        this.authService.getUserInfos(this.cookieUser, this.cookieToken).subscribe({
          next: (resUser: any)=> {
            if (resUser && resUser.data) {
              this.stateService.updateUser(resUser.data);
              this.checkTotalGoals(this.currentUser.last_name ?? '');
            }
            this.showLoader = false;
          },
          error: () => {
            this.showLoader = false;
          }
        });
      },
      error: () => {
        this.showLoader = false;
      }
    });
  }

  handleError(Err:any): Observable<Response> {
    if(Err.error.error.message){
      console.clear();
      this.cookieService.delete('currentToken');
      this.cookieService.delete('currentUser');
    }
    return throwError(Err);
  }



  checkTotalGoals(user: string): void {
    this.totalgoalsService.hasTotalGoals(user).subscribe({
      next:(res) => {

        if(res.length < 1){
          this.showDialog = true;
        }
      },
      error:(err) => {
        console.log(err);
      }
      }
    );
  }

  submitGoals():void {
    if (this.currentUser){
      const lastName: string = this.currentUser.last_name ?? '';
      this.totalgoalsService.submitGoals(lastName, this.goalsForm.value.totalGoalsPrediction, this.cookieToken).subscribe({
        next:(res) => {
          this.showDialog = false;
        },
        error:(err) => {
          console.log(err);
        }
      });
    }
  }

  /** Fetches the kickoff time of the very first Round of 32 match from the API. */
  private getFirstR32KickoffTime(): Observable<Date | null> {
    return this.matchesService.getMatchesByPhase('Round of 32').pipe(
      switchMap(matches => {
        if (!matches || matches.length === 0) return of(null);
        const sorted = matches
          .map(m => ({ ...m, parsedDate: m.date ? new Date(m.date) : null }))
          .filter(m => m.parsedDate && !isNaN(m.parsedDate.getTime()))
          .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
        return of(sorted.length > 0 ? sorted[0].parsedDate : null);
      }),
      catchError(() => of(null))
    );
  }

  checkKnockoutPhase2(userFirstName: string): void {
    if (!userFirstName) return;
    this.getFirstR32KickoffTime().pipe(
      switchMap(kickoff => {
        const now = new Date();
        if (kickoff && now >= kickoff) {
          // First R32 match already kicked off — never show popup
          this.showKnockoutPhase2Dialog = false;
          return of(null);
        }
        return this.knockoutBracketService.getUserKnockoutBracket(userFirstName);
      }),
      catchError(() => of(null))
    ).subscribe({
      next: (data) => {
        if (data === null) return; // already handled above
        if (!data || data.length === 0) {
          this.showKnockoutPhase2Dialog = true;
        } else {
          this.showKnockoutPhase2Dialog = false;
        }
      },
      error: () => {
        this.showKnockoutPhase2Dialog = false;
      }
    });
  }

  goToBracketChallenge(): void {
    this.showKnockoutPhase2Dialog = false;
    this.router.navigate(['/bracket-challenge']);
  }

  closeKnockoutPhase2Dialog(): void {
    this.showKnockoutPhase2Dialog = false;
  }
}
