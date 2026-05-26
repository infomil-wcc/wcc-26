import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { StateService, AppState, user } from './shared/services/core/state.service';
import { AuthService } from './shared/services/core/auth.service';
import { TeamsService } from './shared/services/content/teams.service';
import { CookieService } from 'ngx-cookie-service';
import { Observable, catchError, throwError } from 'rxjs';
import { TotalgoalsService } from './shared/services/core/totalgoals.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {

  @Input() showLoader: boolean = true;
  public title: string = 'IML Foot Challenge - FIFA WORLD CUP 2026';
  public page: number = 0;
  public showDialog: boolean = false;

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
        console.log('state')
      }
    });

  }

  handleAlreadylogged(): void {
    this.authService.tryRefreshToken(this.cookieToken)
    .pipe(
      catchError(err => this.handleError(err))
    )
    .subscribe(() =>{
      this.authService.getUserInfos(this.cookieUser, this.cookieToken).subscribe((res: any)=> {
        this.stateService.updateUser(res.data);
        this.showLoader = false;

        this.checkTotalGoals(this.currentUser.last_name ?? '');
      })
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
      // case 'quiz':
      //   this.page = 8;
      //   break;
      case 'classement':
        this.page = 9;
        break;
      case 'faq':
        this.page = 10;
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
        console.log(res.length, user);

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
}
