import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, switchMap, tap, throwError } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../../../environments/environment';
import { Pronostiques } from '../../contracts/pronostiques.contract';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private httpClient = inject(HttpClient);
  private cookieService = inject(CookieService);
  private prodUrl: string = environment.apiBaseUrl;
  private vercelApi: string = environment.apiUrl;

  private draftsSubject = new BehaviorSubject<any[]>([]);
  drafts$ = this.draftsSubject.asObservable();

  addDraft(prediction: any): void {
    const current = this.draftsSubject.getValue();
    const index = current.findIndex(p => p.game_id === prediction.game_id);
    if (index > -1) {
      current[index] = prediction;
    } else {
      current.push(prediction);
    }
    this.draftsSubject.next([...current]);
  }

  getDrafts(): any[] {
    return this.draftsSubject.getValue();
  }

  clearDrafts(): void {
    this.draftsSubject.next([]);
  }

  sendPrediction(predictions: Pronostiques): Observable<any> {
    let token = this.cookieService.get('currentToken');
  
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      if (predictions.id) {
        return this.httpClient.put(`${this.prodUrl}/items/pronostiques/${predictions.id}`, predictions, httpOptions);
      } else {
        return this.httpClient.post(`${this.prodUrl}/items/pronostiques`, predictions, httpOptions);
      }
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
      return this.httpClient.get<any>(`${environment.apiBaseUrl}/items/pronostiques?filter[game_id]=${gameID}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }

  // updateResults(): Observable<any> {
  //   return this.httpClient.post(`${this.vercelApi}/match-results`, {});
  // }
}
