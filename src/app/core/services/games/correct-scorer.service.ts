import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { MeilleurJoueursApiService } from '../api/meilleur-joueurs-api.service';

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

  private meilleurJoueursApiService = inject(MeilleurJoueursApiService);
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
      return this.meilleurJoueursApiService.getBestPlayers(`?filter[user]=${user}`, httpOptions).pipe(
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
      return this.meilleurJoueursApiService.createBestPlayer(predictions, httpOptions);
    } else {
      return throwError('No token or User found');
    }
  }
}
