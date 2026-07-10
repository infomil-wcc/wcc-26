import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class TotalGoalsApiService {
  private http = inject(HttpClient);

  getTotalGoals(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/total_goals${queryParams}`, options);
  }

  createTotalGoals(payload: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/total_goals`, payload, options);
  }
}
