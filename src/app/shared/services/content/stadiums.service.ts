import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StadiumsService {

  private http = inject(HttpClient);

  getStadium(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/stadiums`).pipe(
      map((response: { data: any; }) => response.data)
    );
  }
}
