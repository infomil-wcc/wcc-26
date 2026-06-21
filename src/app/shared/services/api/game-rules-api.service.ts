import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameRulesApiService {
  private http = inject(HttpClient);

  getGameRules(options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/game-rules`, options);
  }
}
