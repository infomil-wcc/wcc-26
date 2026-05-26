import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap, throwError } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

export interface BestPlayer {
  user: string | null;
  meilleur_buteur: string | null;
  meilleur_joueur: string | null;
  nombre_but: number | null;
  status: string | null;
}



@Injectable({
  providedIn: 'root'
})
export class CorrectscorerService {

  private http = inject(HttpClient);
  private cookieService = inject(CookieService);

  getPronostiqueByUser(user: string | null): Observable<BestPlayer[]>{
    let token = this.cookieService.get('currentToken');

    if (token && user) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/meilleur_jouers?filter[user]=${user}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token or User found');
    }

  }

  makePronostique(predictions: BestPlayer): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.http.post(`https://euro.omediainteractive.net/imleuro/items/meilleur_jouers`, predictions, httpOptions);
    } else {
      return throwError('No token or User found');
    }
  }
}
