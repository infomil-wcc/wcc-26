import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RulesService {

  private http = inject(HttpClient);

  getRules(): Observable<any> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/rules`);
  }
}
