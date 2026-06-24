import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeApiService } from '../api/time-api.service';

@Injectable({
  providedIn: 'root'
})
export class GlobaltimeService {

  private timeApiService = inject(TimeApiService);

  getMuTime(): Observable<string> {
    return this.timeApiService.getCurrentTime('Indian/Mauritius');
  }
}
