import { inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';
import { TotalGoalsApiService } from '../api/total-goals-api.service';
import { Service } from '@angular/core';

@Service()
export class TotalgoalsService {
  private totalGoalsApiService = inject(TotalGoalsApiService);

  hasTotalGoals(user: string): Observable<any> {
    return this.totalGoalsApiService.getTotalGoals(`?filter[trigramme]=${user}`).pipe(
      map(response => response.data)
    );
  }

  submitGoals(user: string, goals: number, token: string): Observable<any> {
    const payload = {
      status: 'published',
      trigramme: user,
      goals: goals
    };

    const httpOptions = {
      headers: new HttpHeaders({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
      })
    };

    return this.totalGoalsApiService.createTotalGoals(payload, httpOptions);
  }
}
