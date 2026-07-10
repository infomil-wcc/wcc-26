import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Service } from '../../../shared/decorators/service.decorator';

@Service()
export class StadiumsApiService {
  private http = inject(HttpClient);

  getStadiums(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/stadiums`);
  }
}
