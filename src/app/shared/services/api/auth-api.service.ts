import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private http = inject(HttpClient);

  authenticate(loginDetails: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/auth/authenticate`, loginDetails, options);
  }

  refresh(refreshDetails: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/auth/refresh`, refreshDetails, options);
  }
}
