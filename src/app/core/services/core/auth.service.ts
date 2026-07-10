import { inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CookieService } from './cookie.service';
import { AuthApiService } from '../api/auth-api.service';
import { UsersApiService } from '../api/users-api.service';
import { Service } from '@angular/core';

@Service()
export class AuthService {

  private authApiService = inject(AuthApiService);
  private usersApiService = inject(UsersApiService);
  private cookieService = inject(CookieService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  trylogin(login: string, pass: string): Observable<any> {
    let loginDetails = {'email': login, 'password': pass, "mode": "jwt"};
    return this.authApiService.authenticate(loginDetails, this.httpOptions);
  }

  tryCreateUser(login: string, trigramme: string, pass: string): Observable<any> {
    const loginDetails = {
      email: login,
      password: pass,
      first_name: trigramme,
      last_name: trigramme,
    };

    return this.usersApiService.createUser(loginDetails, this.httpOptions);
  }

  tryRefreshToken(token: string){
    let refreshdetails = {'token': token}
    return this.authApiService.refresh(refreshdetails, this.httpOptions);
  }

  requestPasswordReset(email: string, reset_url: string): Observable<any> {
    return this.authApiService.requestPasswordReset({ email, reset_url }, this.httpOptions);
  }

  resetPassword(token: string, pass: string): Observable<any> {
    return this.authApiService.resetPassword({ token, password: pass }, this.httpOptions);
  }

  refreshToken(token: string){
    let refreshdetails = {'token': token}
    this.authApiService.refresh(refreshdetails, this.httpOptions)
      .subscribe(res => {
        let results = res as any;
        this.setTokenCookie(results.data.token);
      })
  }

  setTokenCookie(token: string){
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    this.cookieService.set('currentToken', token, expiryDate);
  }

  setUserCookie(user: string){
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    this.cookieService.set('currentUser', user, expiryDate);
  }

  getUsers(token:  string){
    return this.usersApiService.getUsersFromBaseUrl(token);
  }

  getUserInfos(id: string, token: string){
    return this.usersApiService.getUserInfo(id, token);
  }

  deleteCookies(){
    this.cookieService.deleteAll();
  }
}
