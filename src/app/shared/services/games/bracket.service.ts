import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap, throwError } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BracketService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);
  private prodUrl: string = environment.apiBaseUrl;

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

  getBrackets(): Observable<any> {
    return this.httpClient.get<any>(`${this.prodUrl}/items/bracket`).pipe(
      map(response => response.data)
    );
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

  deleteBracket(id: string): Observable<any> {
    let token = this.cookieService.get('currentToken');
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      return this.httpClient.delete(`${this.prodUrl}/items/bracket/${id}`, httpOptions);
    } else {
      return throwError('No token found');
    }
  }
}
