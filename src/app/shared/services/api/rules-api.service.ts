import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RulesApiService {
  private http = inject(HttpClient);

  getRules(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/rules`);
  }

  getScoringRules(options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/game_scoring_rules?limit=-1`, options);
  }
}
