import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class MeilleurJoueursApiService {
  private http = inject(HttpClient);

  getBestPlayers(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/meilleur_jouers${queryParams}`, options);
  }

  createBestPlayer(data: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/meilleur_jouers`, data, options);
  }
}
