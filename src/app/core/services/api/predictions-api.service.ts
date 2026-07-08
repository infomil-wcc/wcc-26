import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PredictionsApiService {
  private http = inject(HttpClient);

  getPredictions(queryParams: string = '', options?: any): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/items/pronostiques${queryParams}`, options);
  }

  createPrediction(prediction: any, options?: any): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/items/pronostiques`, prediction, options);
  }

  updatePrediction(id: any, prediction: any, options?: any): Observable<any> {
    return this.http.patch<any>(`${environment.apiBaseUrl}/items/pronostiques/${id}`, prediction, options);
  }
}
