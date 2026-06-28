import { Component, Input, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { StateService, AppState, user } from './shared/services/core/state.service';
import { AuthService } from './shared/services/core/auth.service';
import { TeamsService } from './shared/services/content/teams.service';
import { CookieService } from './shared/services/core/cookie.service';
import { Observable, catchError, throwError } from 'rxjs';
import { TotalgoalsService } from './shared/services/core/totalgoals.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LayoutComponent } from './shared/components/layout/layout.component';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { HeaderComponent } from './shared/components/header/header.component';
import { HeroComponent } from './shared/components/hero/hero.component';
import { HpnewsComponent } from './components/hpnews/hpnews.component';
import { HomepageComponent } from './pages/homepage/homepage.component';
import { ErrorComponent } from './pages/error/error.component';
import { GamesComponent } from './pages/competition/games/games.component';
import { TeamsComponent } from './pages/competition/teams/teams.component';
import { StadiumsComponent } from './pages/competition/stadiums/stadiums.component';
import { StatisticsComponent } from './pages/competition/statistics/statistics.component';
import { BestScorerComponent } from './pages/games/best-scorer/best-scorer.component';
import { PronostiquesComponent } from './pages/games/pronostiques/pronostiques.component';
import { BracketKnockoutComponent } from './pages/games/bracket-knockout/bracket-knockout.component';
import { BracketChallengeComponent } from './pages/games/bracket-challenge/bracket-challenge.component';
import { QuizComponent } from './pages/games/quiz/quiz.component';
import { RankingComponent } from './pages/games/ranking/ranking.component';
import { FaqComponent } from './pages/faq/faq.component';
import { GameRulesComponent } from './pages/game-rules/game-rules.component';
import { GroupStandingsComponent } from './pages/competition/group-standings/group-standings.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { DialogComponent } from './shared/components/dialog/dialog.component';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { ModalComponent } from './shared/components/modal/modal.component';
import { AppUpdateService } from './shared/services/core/app-update.service';
import { KnockoutBracketService } from './shared/services/games/knockout-bracket.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LayoutComponent, NgSwitch, HeaderComponent, NgSwitchCase, HeroComponent, HpnewsComponent, HomepageComponent, ErrorComponent, GamesComponent, TeamsComponent, StadiumsComponent, StatisticsComponent, BestScorerComponent, PronostiquesComponent, BracketKnockoutComponent, BracketChallengeComponent, QuizComponent, RankingComponent, FaqComponent, GameRulesComponent, GroupStandingsComponent, RouterOutlet, FooterComponent, DialogComponent, ReactiveFormsModule, LoaderComponent, ModalComponent]
})
export class AppComponent implements OnInit {

  public appUpdate = inject(AppUpdateService);
  private knockoutBracketService = inject(KnockoutBracketService);
  
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
    private router: Router,
    private stateService: StateService,
    private euroService: TeamsService,
    private authService: AuthService,
    private totalgoalsService: TotalgoalsService,
    private cookieService: CookieService,
    private formBuilder: FormBuilder
  ){
    router.events.forEach((event) => {
      if(event instanceof NavigationStart) {
        this.internalRoute(event.url.split('/#')[1])
      }
    })
  }

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
          const now = new Date();
          const limit = new Date(2026, 5, 28, 23, 0, 0);
          if (now < limit) {
            this.showKnockoutPhase2Dialog = true;
          }
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

  internalRoute(route: string):void {
    switch (route) {
      case 'les-matchs':
        this.page = 1;
        break;
      case 'les-equipes':
        this.page = 2;
        break;
      case 'les-stades':
        this.page = 3;
        break;
      case 'statistiques':
        this.page = 4;
        break;
      case 'meilleur-buteur':
        this.page = 5;
        break;
      case 'pronostiques':
        this.page = 6;
        break;
      case 'bracket':
        this.page = 7;
        break;
      case 'bracket-challenge':
        this.page = 13;
        break;
      // case 'quiz':
      //   this.page = 8;
      //   break;
      case 'classement':
        this.page = 9;
        break;
      case 'faq':
        this.page = 10;
        break;
      case 'game-rules':
        this.page = 12;
        break;
      case 'les-groupes':
        this.page = 14;
        break;
      case 'accueil':
        this.page = 0;
        break;
      case undefined:
        this.page = 0;
        route = "accueil"
        break;
      default:
        this.page = 11;
        break;
    }
    this.stateService.updateState({ currentPage: route });
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

  checkKnockoutPhase2(userFirstName: string): void {
    if (!userFirstName) return;
    this.knockoutBracketService.getUserKnockoutBracket(userFirstName).subscribe({
      next: (data) => {
        const now = new Date();
        const limit = new Date(2026, 5, 28, 23, 0, 0);
        if ((!data || data.length === 0) && now < limit) {
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
    this.page = 13;
    this.router.navigate([], { fragment: 'bracket-challenge' });
  }

  closeKnockoutPhase2Dialog(): void {
    this.showKnockoutPhase2Dialog = false;
  }
}
