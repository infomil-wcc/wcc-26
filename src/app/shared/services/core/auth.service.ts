import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);

  private sudo = {
    'email': 'infomil.foot@gmail.com',
    'password': '1nf0m1l2024'
  }

  private token: string = '';
  private prodUrl: string = 'https://euro.omediainteractive.net/imleuro';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  constructor() { }


  trylogin(login: string, pass: string): Observable<any> {
    let loginDetails = {'email': login, 'password': pass, "mode": "jwt"};
    return this.httpClient.post<any>(`${this.prodUrl}/auth/authenticate`, loginDetails, this.httpOptions);
  }

  tryCreateUser(login: string, trigramme: string, pass: string): Observable<any> {
    return this.httpClient.post<any>(`${this.prodUrl}/auth/authenticate`, this.sudo, this.httpOptions).pipe(
      switchMap((res) => {
        const token = res.data.token;

        const createHttpOptions = {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          })
        };

        const loginDetails = {
          email: login,
          last_name: trigramme,
          first_name: trigramme,
          password: pass,
          status: 'active',
          role: 3
        };

        return this.httpClient.post<any>(`${this.prodUrl}/users`, loginDetails, createHttpOptions);
      })
    );
  }

  tryRefreshToken(token: string){
    let refreshdetails = {'token': token}
    return this.httpClient.post(`${this.prodUrl}/auth/refresh`, refreshdetails, this.httpOptions);
  }

  refreshToken(token: string){
    let refreshdetails = {'token': token}
    this.httpClient.post(`${this.prodUrl}/auth/refresh`, refreshdetails, this.httpOptions)
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
    return this.httpClient.get(`${this.prodUrl}/users?access_token=${token}`);
  }

  getUserInfos(id: string, token: string){
    return this.httpClient.get(`${this.prodUrl}/users/${id}?access_token=${token}`);
  }

  deleteCookies(){
    this.cookieService.deleteAll();
  }
}
