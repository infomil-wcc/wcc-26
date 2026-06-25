import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, throwError, tap } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { Pronostiques } from '../../contracts/pronostiques.contract';
import { PredictionsApiService } from '../api/predictions-api.service';
import { RankingcalculationService } from '../core/rankingcalculation.service';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private predictionsApiService = inject(PredictionsApiService);
  private cookieService = inject(CookieService);
  private rankingcalculationService = inject(RankingcalculationService);

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
        return this.predictionsApiService.updatePrediction(predictions.id, predictions, httpOptions);
      } else {
        return this.predictionsApiService.createPrediction(predictions, httpOptions);
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
      return this.predictionsApiService.getPredictions(`?filter[game_id]=${gameID}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }

  updateResults(): Observable<any> {
    // Simply trigger the client-side ranking recalculation since results are managed via match-scheduler cron on the backend
    this.rankingcalculationService.startCalcRanking();
    return new Observable(subscriber => {
      subscriber.next({ success: true, message: 'Local calculation triggered.' });
      subscriber.complete();
    });
  }
}
