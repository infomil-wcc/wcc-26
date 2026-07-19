import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsersApiService {
  private http = inject(HttpClient);

  getUsersFromApiUrl(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/users`);
  }

  createUser(loginDetails: any, options: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users`, loginDetails, options);
  }

  getUsersFromBaseUrl(token: string): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/users?access_token=${token}`);
  }

  getUserInfo(id: string, token: string): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/users/${id}?fields=*,role.name&access_token=${token}`);
  }
}
