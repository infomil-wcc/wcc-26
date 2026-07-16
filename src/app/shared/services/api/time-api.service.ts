import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimeApiService {
  private http = inject(HttpClient);

  getCurrentTime(timeZone: string = 'Indian/Mauritius'): Observable<any> {
    const now = new Date();
    
    // Get current UTC time components
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const date = now.getUTCDate();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const seconds = now.getUTCSeconds();
    const ms = now.getUTCMilliseconds();
    
    // Shift by +4 hours for Mauritius time
    const muTime = new Date(Date.UTC(year, month, date, hours + 4, minutes, seconds, ms));
    
    const muYear = muTime.getUTCFullYear();
    const muMonth = String(muTime.getUTCMonth() + 1).padStart(2, '0');
    const muDate = String(muTime.getUTCDate()).padStart(2, '0');
    const muHours = String(muTime.getUTCHours()).padStart(2, '0');
    const muMinutes = String(muTime.getUTCMinutes()).padStart(2, '0');
    const muSeconds = String(muTime.getUTCSeconds()).padStart(2, '0');
    const muMs = String(muTime.getUTCMilliseconds()).padStart(3, '0');

    const dateTime = `${muYear}-${muMonth}-${muDate}T${muHours}:${muMinutes}:${muSeconds}.${muMs}+04:00`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return of({
      year: muYear,
      month: muTime.getUTCMonth() + 1,
      day: muTime.getUTCDate(),
      hour: muTime.getUTCHours(),
      minute: muTime.getUTCMinutes(),
      seconds: muTime.getUTCSeconds(),
      milliSeconds: muTime.getUTCMilliseconds(),
      dateTime: dateTime,
      date: `${muMonth}/${muDate}/${muYear}`,
      time: `${muHours}:${muMinutes}`,
      timeZone: timeZone,
      dayOfWeek: dayNames[muTime.getUTCDay()],
      dstActive: false
    });
  }
}
