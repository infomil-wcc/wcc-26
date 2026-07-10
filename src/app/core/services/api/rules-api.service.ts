import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class RulesApiService {
  private http = inject(HttpClient);

  getRules(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/rules`);
  }
}
