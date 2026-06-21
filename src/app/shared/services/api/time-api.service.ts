import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimeApiService {
  private http = inject(HttpClient);

  getCurrentTime(timeZone: string = 'Indian/Mauritius'): Observable<any> {
    return this.http.get<any>(`https://timeapi.io/api/time/current/zone?timeZone=${timeZone}`);
  }
}
