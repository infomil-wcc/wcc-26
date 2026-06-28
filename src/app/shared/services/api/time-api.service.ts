import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimeApiService {
  private http = inject(HttpClient);

  getCurrentTime(timeZone: string = 'Indian/Mauritius'): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/time/current/zone?timeZone=${timeZone}`).pipe(
      catchError(err => {
        console.warn('timeapi.io request failed, falling back to local client time.', err);
        const now = new Date();
        return of({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          seconds: now.getSeconds(),
          milliSeconds: now.getMilliseconds(),
          dateTime: now.toISOString(),
          date: `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`,
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          timeZone: timeZone,
          dayOfWeek: now.toLocaleString('en-US', { weekday: 'long' }),
          dstActive: false
        });
      })
    );
  }
}
