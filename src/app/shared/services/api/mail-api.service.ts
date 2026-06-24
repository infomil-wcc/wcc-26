import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MailApiService {
  private http = inject(HttpClient);

  sendMail(payload: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/mail`, payload, options);
  }
}
