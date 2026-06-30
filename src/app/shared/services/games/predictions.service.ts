import { Injectable, inject } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, map, throwError, tap, switchMap } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { Pronostiques } from '../../contracts/pronostiques.contract';
import { PredictionsApiService } from '../api/predictions-api.service';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private predictionsApiService = inject(PredictionsApiService);
  private cookieService = inject(CookieService);
  private http = inject(HttpClient);

  private draftsSubject = new BehaviorSubject<any[]>([]);
  drafts$ = this.draftsSubject.asObservable();

  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  triggerRefresh(): void {
    this.refreshSubject.next();
  }

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

  sendPrediction(predictions: Pronostiques, matchKickoffTimeStr: string): Observable<any> {
    const token = this.cookieService.get('currentToken');

    if (!token) {
      return throwError(() => new Error('No token found'));
    }

    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    };

    // Optional UI Optimization: Querying the centralized time proxy before posting
    return this.http.get<any>(`/api/time/current/zone?timeZone=Indian/Mauritius`).pipe(
     switchMap((timeResponse) => {
        const backendCurrentTime = new Date(timeResponse.dateTime);
        const matchKickoffTime = new Date(matchKickoffTimeStr);

        // 2. Lockout validation step
        if (backendCurrentTime >= matchKickoffTime) {
          return throwError(() => new Error('MATCH_ALREADY_STARTED'));
        }

        // 3. Forward prediction payload to Directus API
        if (predictions.id) {
          return this.predictionsApiService.updatePrediction(predictions.id, predictions, httpOptions);
        } else {
          return this.predictionsApiService.createPrediction(predictions, httpOptions);
        }
      })
    );
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
      return throwError(() => new Error('No token found'));
    }
}

  updateResults(): Observable<any> {
    // Trigger the backend ranking recalculation
    return this.http.get('/api/match-results?points=all');
  }
}
