import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class SquadsApiService {
  private http = inject(HttpClient);

  getPlayersByCountry(country: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/squads?country=${country}`);
  }
}
