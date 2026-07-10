import { inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RulesApiService } from '../api/rules-api.service';
import { Service } from '@angular/core';

@Service()
export class RulesService {

  private rulesApiService = inject(RulesApiService);

  private rulesResource = resource({
    loader: async () => {
      const response = await firstValueFrom(this.rulesApiService.getRules());
      return response?.data || null;
    }
  });

  rules = this.rulesResource.value;
}
