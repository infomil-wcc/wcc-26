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

  requestPasswordReset(payload: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/auth/password/request`, payload, options);
  }

  resetPassword(payload: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/auth/password/reset`, payload, options);
  }
}
