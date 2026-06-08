import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiResponse } from '../../contracts/game-rules.contract';
import { Observable, map } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class GameRulesService {

constructor(private http: HttpClient) { }

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  getGameRules(): Observable<ApiResponse> {
     return this.http.get<ApiResponse>(`/api/regles`, this.httpOptions);
  }
}
