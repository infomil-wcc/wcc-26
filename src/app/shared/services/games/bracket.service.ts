import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap, throwError } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
  providedIn: 'root'
})
export class BracketService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);
  private prodUrl: string = 'https://euro.omediainteractive.net/imleuro';

  getUserBracket(user: string | null): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.httpClient.get<any>(`${this.prodUrl}/items/bracket?filter[user]=${user}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }

  postBracket(bracket: any): Observable<any> {
    let token = this.cookieService.get('currentToken');
  
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.httpClient.post(`${this.prodUrl}/items/bracket`, bracket, httpOptions);
    } else {
      return throwError('No token found');
    }
  }
}
