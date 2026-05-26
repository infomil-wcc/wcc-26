import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StadiumsService {

  private http = inject(HttpClient);

  getStadium(): Observable<any> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/stadiums`).pipe(
      map((response: { data: any; }) => response.data)
    );
  }
}
