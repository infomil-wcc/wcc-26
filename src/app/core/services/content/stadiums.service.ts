import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { StadiumsApiService } from '../api/stadiums-api.service';

@Injectable({
  providedIn: 'root'
})
export class StadiumsService {

  private stadiumsApiService = inject(StadiumsApiService);

  getStadium(): Observable<any> {
    return this.stadiumsApiService.getStadiums().pipe(
      map((response: { data: any; }) => response.data)
    );
  }
}
