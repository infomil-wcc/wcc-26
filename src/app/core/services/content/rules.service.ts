import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RulesApiService } from '../api/rules-api.service';

@Injectable({
  providedIn: 'root'
})
export class RulesService {

  private rulesApiService = inject(RulesApiService);

  getRules(): Observable<any> {
    return this.rulesApiService.getRules();
  }
}
