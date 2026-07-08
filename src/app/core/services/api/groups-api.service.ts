import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GroupsApiService {
  private http = inject(HttpClient);

  getGroups(): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/group`);
  }
}
