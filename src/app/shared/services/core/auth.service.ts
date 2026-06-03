import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  trylogin(login: string, pass: string): Observable<any> {
    let loginDetails = {'email': login, 'password': pass, "mode": "jwt"};
    return this.httpClient.post<any>(`${environment.apiBaseUrl}/auth/authenticate`, loginDetails, this.httpOptions);
  }

  tryCreateUser(login: string, trigramme: string, pass: string): Observable<any> {
    const loginDetails = {
      email: login,
      password: pass,
      first_name: trigramme,
      last_name: trigramme,
    };

    return this.httpClient.post<any>(`/api/users`, loginDetails, this.httpOptions);
  }

  tryRefreshToken(token: string){
    let refreshdetails = {'token': token}
    return this.httpClient.post(`${environment.apiBaseUrl}/auth/refresh`, refreshdetails, this.httpOptions);
  }

  refreshToken(token: string){
    let refreshdetails = {'token': token}
    this.httpClient.post(`${environment.apiBaseUrl}/auth/refresh`, refreshdetails, this.httpOptions)
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
    return this.httpClient.get(`${environment.apiBaseUrl}/users?access_token=${token}`);
  }

  getUserInfos(id: string, token: string){
    return this.httpClient.get(`${environment.apiBaseUrl}/users/${id}?access_token=${token}`);
  }

  deleteCookies(){
    this.cookieService.deleteAll();
  }
}
