import { inject, resource } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ApiResponse } from '../../../shared/contracts/game-rules.contract';
import { firstValueFrom } from 'rxjs';
import { GameRulesApiService } from '../api/game-rules-api.service';
import { Service } from '@angular/core';

@Service()
export class GameRulesService {
  private gameRulesApiService = inject(GameRulesApiService);

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  private gameRulesResource = resource({
    loader: async () => {
      const response = await firstValueFrom(this.gameRulesApiService.getGameRules(this.httpOptions));
      return response?.data || null;
    }
  });

  gameRules = this.gameRulesResource.value;
}
