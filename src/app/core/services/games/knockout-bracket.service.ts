import { inject, resource } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { KnockoutBracketApiService } from '../api/knockout-bracket-api.service';
import { Service } from '@angular/core';

@Service()
export class KnockoutBracketService {
  private knockoutBracketApiService = inject(KnockoutBracketApiService);
  private cookieService = inject(CookieService);

  private knockoutBracketsResource = resource({
    loader: async () => {
      const response = await firstValueFrom(this.knockoutBracketApiService.getKnockoutBrackets());
      return response?.data || [];
    }
  });

  knockoutBrackets = this.knockoutBracketsResource.value;

  getUserKnockoutBracket(user: string | null): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return new Observable(observer => {
        this.knockoutBracketApiService.getKnockoutBrackets(`?filter[user]=${user}`, httpOptions).subscribe({
          next: response => {
            observer.next(response.data);
            observer.complete();
          },
          error: err => observer.error(err)
        });
      });
    } else {
      return throwError(() => new Error('No token found'));
    }
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
      return throwError(() => new Error('No token found'));
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
      return throwError(() => new Error('No token found'));
    }
  }
}
