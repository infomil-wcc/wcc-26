import { inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CookieService } from './cookie.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { Service } from '@angular/core';
import { Observable } from 'rxjs';

export interface AppState {
  loggedIn: boolean;
  currentPage: string;
}

export interface user {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
}

@Service()
export class StateService {

  private authService = inject(AuthService);
  private router = inject(Router);

  private loaderSignal = signal<boolean>(false);
  private currentStateSignal = signal<AppState>({
    loggedIn: false,
    currentPage: 'accueil'
  });
  private userSignal = signal<user>({
    id : null,
    first_name: null,
    last_name: null,
    email: null,
    status: null,
  });

  loader = this.loaderSignal.asReadonly();
  state = this.currentStateSignal.asReadonly();
  user = this.userSignal.asReadonly();

  userState: Observable<user> = toObservable(this.userSignal);
  currentState: Observable<AppState> = toObservable(this.currentStateSignal);
  loaderState: Observable<boolean> = toObservable(this.loaderSignal);

  updateState(newState: Partial<AppState>) {
    this.currentStateSignal.update(state => ({ ...state, ...newState }));
  }

  updateUser(userData: user){
    if (!userData) {
      return;
    }
    this.userSignal.set({
      id : userData.id,
      first_name:  userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      status: userData.status,
    });
  }

  toggleLoader() {
    this.loaderSignal.update(val => !val);
  }

  logoutUser() {
    this.userSignal.set({
      id : null,
      first_name: null,
      last_name: null,
      email: null,
      status: null,
    });

    this.authService.deleteCookies();

    this.router.navigate(['/accueil']);
  }
}
