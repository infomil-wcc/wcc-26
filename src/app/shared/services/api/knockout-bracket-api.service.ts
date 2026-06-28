import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KnockoutBracketApiService {
  private http = inject(HttpClient);

  getKnockoutBrackets(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/knockout_bracket${queryParams}`, options);
  }

  createKnockoutBracket(bracket: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/knockout_bracket`, bracket, options);
  }

  deleteKnockoutBracket(id: string, options?: any): Observable<any> {
    return this.http.delete<any>(`${environment.apiBaseUrl}/items/knockout_bracket/${id}`, options);
  }
}
