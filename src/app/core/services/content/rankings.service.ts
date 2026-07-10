import { inject, resource } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { PronosticsRankingsApiService } from '../api/pronostics-rankings-api.service';
import { BracketRankingsApiService } from '../api/bracket-rankings-api.service';
import { AuthService } from '../core/auth.service';
import { Service } from '@angular/core';

@Service()
export class RankingsService {
  private pronosticsRankingsApiService = inject(PronosticsRankingsApiService);
  private bracketRankingsApiService = inject(BracketRankingsApiService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private rankingBot = {
    'email': 'ranking.bot@infomil.mu',
    'password': 'infomil'
  };

  private async getAuthHeaders() {
    const loginRes = await firstValueFrom(this.authService.trylogin(this.rankingBot.email, this.rankingBot.password));
    const data = loginRes?.data || loginRes;
    const token = data?.token || data?.access_token || '';
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    };
  }

  private pronosticsRankingsResource = resource({
    loader: async () => {
      const httpOptions = await this.getAuthHeaders();
      const response = await firstValueFrom(this.pronosticsRankingsApiService.getRankings('', httpOptions));
      return response?.data || [];
    }
  });

  private bracketRankingsResource = resource({
    loader: async () => {
      const httpOptions = await this.getAuthHeaders();
      const response = await firstValueFrom(this.bracketRankingsApiService.getRankings('', httpOptions));
      return response?.data || [];
    }
  });

  pronosticsRankings = this.pronosticsRankingsResource.value;
  bracketRankings = this.bracketRankingsResource.value;

  reloadPronostics() {
    this.pronosticsRankingsResource.reload();
  }

  reloadBrackets() {
    this.bracketRankingsResource.reload();
  }

  async getUserRanking(username: string) {
    const httpOptions = await this.getAuthHeaders();
    const response = await firstValueFrom(this.pronosticsRankingsApiService.getRankings(`?filter[key]=${username}`, httpOptions));
    return response?.data || [];
  }

  recalculateRankings(): Observable<any> {
    return this.http.get('/api/match-results?points=all');
  }
}
