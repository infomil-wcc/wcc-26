import { computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Service } from '@angular/core';

@Service()
export class StadiumsService {
  private _stadiumsRes = httpResource<any>(() => `${environment.apiBaseUrl}/items/stadiums`);
  readonly stadiums = computed(() => this._stadiumsRes.value()?.data || []);
}
