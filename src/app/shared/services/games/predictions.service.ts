import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap, throwError } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { Pronostiques } from '../../contracts/pronostiques.contract';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);
  private prodUrl: string = 'https://euro.omediainteractive.net/imleuro';

  sendPrediction(predictions: Pronostiques): Observable<any> {
    let token = this.cookieService.get('currentToken');
  
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.httpClient.post(`${this.prodUrl}/items/pronostiques`, predictions, httpOptions);
    } else {
      return throwError('No token found');
    }
  }

  getMyPredictions(gameID: string): Observable<any>{

    let token = this.cookieService.get('currentToken');
    
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.httpClient.get<any>(`https://euro.omediainteractive.net/imleuro/items/pronostiques?filter[game_id]=${gameID}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }
}
