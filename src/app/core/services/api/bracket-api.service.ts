import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BracketApiService {
  private http = inject(HttpClient);

  getBrackets(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/bracket${queryParams}`, options);
  }

  createBracket(bracket: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/bracket`, bracket, options);
  }

  deleteBracket(id: string, options?: any): Observable<any> {
    return this.http.delete<any>(`${environment.apiBaseUrl}/items/bracket/${id}`, options);
  }
}
