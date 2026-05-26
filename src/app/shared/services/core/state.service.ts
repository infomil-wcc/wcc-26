import { Injectable, inject } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

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

@Injectable({
  providedIn: 'root'
})

export class StateService {

  private authService = inject(AuthService);

  private _loaderState = new BehaviorSubject<boolean>(false);

  private _currentState = new BehaviorSubject<AppState>({
    loggedIn: false,
    currentPage: 'accueil'
  });

  private _user = new BehaviorSubject<user>({
    id : null,
    first_name: null,
    last_name: null,
    email: null,
    status: null,
  });

  get userState(): Observable<user> {
    return this._user.asObservable();
  }

  get currentState() {
    return this._currentState.asObservable();
  }

  get loaderState() {
    return this._loaderState.asObservable();
  }

  updateState(newState: Partial<AppState>) {
    let currentState = this._currentState.getValue();
    let updatedState = { ...currentState, ...newState };
    this._currentState.next(updatedState);
  }

  updateUser(userData: user){
    this._user.next({
      id : userData.id,
      first_name:  userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      status: userData.status,
    })
  }

  toggleLoader() {
    this._loaderState.next(!this._loaderState.getValue());
  }

  logoutUser() {
    this._user.next({
      id : null,
      first_name: null,
      last_name: null,
      email: null,
      status: null,
    })

    this.authService.deleteCookies();

    location.href="#accueil";
  }

}
