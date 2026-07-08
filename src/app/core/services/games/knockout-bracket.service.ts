import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { KnockoutBracketApiService } from '../api/knockout-bracket-api.service';

@Injectable({
  providedIn: 'root'
})
export class KnockoutBracketService {
  private knockoutBracketApiService = inject(KnockoutBracketApiService);
  private cookieService = inject(CookieService);

  getUserKnockoutBracket(user: string | null): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.knockoutBracketApiService.getKnockoutBrackets(`?filter[user]=${user}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }

  getKnockoutBrackets(): Observable<any> {
    return this.knockoutBracketApiService.getKnockoutBrackets().pipe(
      map(response => response.data)
    );
  }

  postKnockoutBracket(bracket: any): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.knockoutBracketApiService.createKnockoutBracket(bracket, httpOptions);
    } else {
      return throwError('No token found');
    }
  }

  deleteKnockoutBracket(id: string): Observable<any> {
    let token = this.cookieService.get('currentToken');
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      return this.knockoutBracketApiService.deleteKnockoutBracket(id, httpOptions);
    } else {
      return throwError('No token found');
    }
  }
}
