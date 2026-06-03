import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RulesService {

  private http = inject(HttpClient);

  getRules(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/rules`);
  }
}
