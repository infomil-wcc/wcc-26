import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ApiResponse } from '../../../shared/contracts/game-rules.contract';
import { Observable } from 'rxjs';
import { GameRulesApiService } from '../api/game-rules-api.service';

@Injectable({
  providedIn: 'root'
})
export class GameRulesService {
  private gameRulesApiService = inject(GameRulesApiService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  getGameRules(): Observable<ApiResponse> {
     return this.gameRulesApiService.getGameRules(this.httpOptions);
  }
}
