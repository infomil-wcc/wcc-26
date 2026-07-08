import { Injectable, inject } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, map, throwError, tap, switchMap } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { Pronostiques } from '../../contracts/pronostiques.contract';
import { PredictionsApiService } from '../api/predictions-api.service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {

  private predictionsApiService = inject(PredictionsApiService);
  private cookieService = inject(CookieService);
  private http = inject(HttpClient);

  private draftsSubject = new BehaviorSubject<any[]>([]);
  drafts$ = this.draftsSubject.asObservable();

  // Map of game_id -> freshly saved prediction data, broadcast after a successful save
  private savedPredictionsSubject = new BehaviorSubject<Map<string, any>>(new Map());
  savedPredictions$ = this.savedPredictionsSubject.asObservable();

  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  triggerRefresh(): void {
    this.refreshSubject.next();
  }

  /** Called after a successful API save with the saved prediction object returned by Directus */
  markAsSaved(gameId: string, savedData: any): void {
    const current = this.savedPredictionsSubject.getValue();
    current.set(gameId, savedData);
    this.savedPredictionsSubject.next(new Map(current));
  }

  /** Retrieve the last saved prediction for a given game */
  getSavedPrediction(gameId: string): any | null {
    return this.savedPredictionsSubject.getValue().get(gameId) ?? null;
  }

  /** Clear the saved predictions map (e.g. on logout or page reset) */
  clearSavedPredictions(): void {
    this.savedPredictionsSubject.next(new Map());
  }

  addDraft(prediction: any): void {
    const current = this.draftsSubject.getValue();
    const index = current.findIndex(p => String(p.game_id) === String(prediction.game_id));
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

  removeDraft(gameId: number | string): void {
    const current = this.draftsSubject.getValue();
    const updated = current.filter(p => p.game_id !== gameId && p.game_id !== Number(gameId) && String(p.game_id) !== String(gameId));
    if (current.length !== updated.length) {
      this.draftsSubject.next(updated);
    }
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
    return this.http.get<any>(`${environment.apiUrl}/time/current/zone?timeZone=Indian/Mauritius`).pipe(
     switchMap((timeResponse) => {
        const backendCurrentTime = new Date(timeResponse.dateTime);
        const matchKickoffTime = new Date(matchKickoffTimeStr);

        // 2. Lockout validation step
        if (backendCurrentTime >= matchKickoffTime) {
          return throwError(() => new Error('MATCH_ALREADY_STARTED'));
        }

        // 3. Forward prediction payload to Directus API
        if (predictions.id) {
          const updatePayload = {
            game_id: predictions.game_id,
            halftime_a: predictions.halftime_a,
            halftime_b: predictions.halftime_b,
            fulltime_a: predictions.fulltime_a,
            fulltime_b: predictions.fulltime_b,
            scorer: predictions.scorer,
            winner_draw: predictions.winner_draw
          };
          return this.predictionsApiService.updatePrediction(predictions.id, updatePayload, httpOptions);
        } else {
          // Extra validation to prevent duplicate records
          return this.getMyPredictions(predictions.game_id).pipe(
            switchMap((existingPreds) => {
              if (existingPreds && existingPreds.length > 0) {
                // A prediction already exists, use its ID and update instead
                const existingId = existingPreds[0].id;
                const updatePayload = {
                  game_id: predictions.game_id,
                  halftime_a: predictions.halftime_a,
                  halftime_b: predictions.halftime_b,
                  fulltime_a: predictions.fulltime_a,
                  fulltime_b: predictions.fulltime_b,
                  scorer: predictions.scorer,
                  winner_draw: predictions.winner_draw
                };
                return this.predictionsApiService.updatePrediction(existingId, updatePayload, httpOptions);
              } else {
                return this.predictionsApiService.createPrediction(predictions, httpOptions);
              }
            })
          );
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
      const gameIDStr = String(gameID);
      const queryString = gameIDStr.startsWith('[') ? `?filter[game_id]${gameIDStr}` : `?filter[game_id]=${gameIDStr}`;
      return this.predictionsApiService.getPredictions(queryString, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError(() => new Error('No token found'));
    }
}

  updateResults(): Observable<any> {
    // Trigger the backend ranking recalculation
    return this.http.get(`${environment.apiUrl}/match-results?points=all`);
  }

  updateMatchResults(matchId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/match-results?matches=${matchId}&points=all`);
  }
}
