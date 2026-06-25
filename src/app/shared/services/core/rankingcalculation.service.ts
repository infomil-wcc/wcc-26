import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, groupBy, mergeMap, toArray, reduce } from 'rxjs/operators';
import { CookieService } from './cookie.service';
import { MatchesService } from '../content/matches.service';
import { Matches } from '../../contracts/matches.contract';
import { Pronostiques, pronostiquesApiData } from '../../contracts/pronostiques.contract';
import { AuthService } from './auth.service';
import { PronosticsRankingsApiService } from '../api/pronostics-rankings-api.service';
import { BracketRankingsApiService } from '../api/bracket-rankings-api.service';
import { BracketApiService } from '../api/bracket-api.service';
import { BracketResultApiService } from '../api/bracket-result-api.service';
import { PredictionsApiService } from '../api/predictions-api.service';
import { GameRulesService } from '../content/game-rules.service';

interface result {
  id: number;
  phase: string;
  team_a: string;
  team_b: string;
  fulltime_a: number;
  fulltime_b: number;
  halftime_a: number;
  halftime_b: number;
  scorer: string;
  winner_point: number;
  halftime_point: number;
  fulltime_point: number;
  scorer_point: number;
}

@Injectable({
  providedIn: 'root'
})
export class RankingcalculationService {

  private pronosticsRankingsApiService = inject(PronosticsRankingsApiService);
  private bracketRankingsApiService = inject(BracketRankingsApiService);
  private bracketApiService = inject(BracketApiService);
  private bracketResultApiService = inject(BracketResultApiService);
  private predictionsApiService = inject(PredictionsApiService);
  private cookieService = inject(CookieService);
  private matchService = inject(MatchesService);
  private authService = inject(AuthService);
  private gameRulesService = inject(GameRulesService);
  private rankingToken!: string;
  private $pronostiques!: Observable<any>;
  private bracketRankingObj: any = [];
  private bracketResult!: any;

  private rankingBot = {
    'email': 'ranking.bot@infomil.mu',
    'password': 'infomil'
  }

  getCurrentrankings(): Observable<any> {
    return this.pronosticsRankingsApiService.getRankings().pipe(
      map(response => response.data));
  }

  getBracketRankings(): Observable<any> {
    return this.bracketRankingsApiService.getRankings().pipe(map(response => response.data));
  }


  startCalcRanking(): void {
    this.getToken().subscribe({
      next: (result) => {
        this.rankingToken = result.data.token;
        this.$pronostiques = this.getUsersPronostiques(this.rankingToken);

        this.$pronostiques.subscribe({
          next: (response) => {
            this.calcRanking(response);
            // this.calcBracket();
          }
        });
      }
    });
  }

  getToken(): Observable<any> {
    return this.authService.trylogin(this.rankingBot.email, this.rankingBot.password);
  }

  calcBracket() {
    this.getToken().subscribe({
      next: (result) => {
        this.rankingToken = result.data.token;
        this.gameRulesService.getGameRules().subscribe({
          next: (rulesResponse) => {
            const bracketGame = rulesResponse?.elements?.find((el: any) => el.id === 'jeu_bracket');
            const bareme = bracketGame?.bareme_points || {
              "16eme_de_finale": 10,
              "8eme_de_finale": 20,
              "quart_de_finale": 30,
              "demi_finale": 40,
              "finale": 100
            };
            const bonusFinalist = bracketGame?.bonus_equipe_finale || 75;

            this.getBracketResults().subscribe({
              next: (results) => {
                this.bracketResult = results[0];
                this.getBrackets().subscribe({
                  next: (brackets) => {
                    this.bracketRankingObj = [];
                    brackets.forEach((bracket: any) => {
                      this.calcBracketPoint(bracket, bareme, bonusFinalist, brackets.length);
                    });
                  }
                });
              }
            });
          },
          error: () => {
            const bareme = {
              "16eme_de_finale": 10,
              "8eme_de_finale": 20,
              "quart_de_finale": 30,
              "demi_finale": 40,
              "finale": 100
            };
            const bonusFinalist = 75;

            this.getBracketResults().subscribe({
              next: (results) => {
                this.bracketResult = results[0];
                this.getBrackets().subscribe({
                  next: (brackets) => {
                    this.bracketRankingObj = [];
                    brackets.forEach((bracket: any) => {
                      this.calcBracketPoint(bracket, bareme, bonusFinalist, brackets.length);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  private getBrackets(): Observable<any> {
    return this.bracketApiService.getBrackets().pipe(
      map(response => response.data));
  }

  private getBracketResults(): Observable<any> {
    return this.bracketResultApiService.getBracketResult().pipe(
      map(response => response.data));
  }

  private getUsersPronostiques(token: string): Observable<any> {
    let httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    }

    return this.predictionsApiService.getPredictions('', httpOptions).pipe(
      map(response => response.data as Pronostiques[]),
      mergeMap(pronostiques => from(pronostiques)),
      groupBy((pronostique: Pronostiques) => pronostique.user),
      mergeMap(group => group.pipe(toArray())),
      reduce((acc, group) => {
        const user = group[0].user;
        if (user) {
          acc[user] = group;
        }
        return acc;
      }, {} as { [user: string]: Pronostiques[] })
    );
  }

  private calcRanking(pronostiques: any): void {
    this.getMatchesPlayed().subscribe({
      next: (playedMatches: any) => {
        let rankingObj: any[] = [];
        let resultMatches = playedMatches;
        let keys = Object.keys(pronostiques);

        keys.forEach((key) => {
          let point = 0;
          const userPronos = pronostiques[key].map((prono: any) => ({
            id: prono.id,
            game_id: prono.game_id,
            user: prono.user,
            winner_draw: prono.winner_draw,
            fulltime_a: prono.fulltime_a,
            fulltime_b: prono.fulltime_b,
            halftime_a: prono.halftime_a,
            halftime_b: prono.halftime_b,
            scorer: prono.scorer
          }));

          pronostiques[key].forEach((prono: any) => {
            point = this.calcResult(prono.game_id, prono, resultMatches) + point;
          });

          rankingObj.push({ key, point, pronostiques: userPronos });
        });

        this.updateRanking(rankingObj);
      }
    })
  }


  private getMatchesPlayed(): Observable<Matches[]> {
    return this.matchService.getPlayedMatches();
  }

  private calcResult(gameId: any, pronostique: any, results: any): number {
    let game = results.find((m: any) => String(m.id) === String(pronostique.game_id));
    let finalPoint: number = 0;

    if (game) {
      let winner_point = game.winner_point;
      let halftime_point = game.halftime_point;
      let fulltime_point = game.fulltime_point;
      let scorer_point = game.scorer_point;

      let halftime_a = pronostique.halftime_a;
      let halftime_b = pronostique.halftime_b;
      let fulltime_a = pronostique.fulltime_a;
      let fulltime_b = pronostique.fulltime_b;
      let winner_draw = pronostique.winner_draw;
      let scorers = pronostique.scorer;

      // Group Stage Calculation
      if (game.phase === 'Group Stage') {
        let point;

        (game.winner_draw === winner_draw) ? point = winner_point : point = 0;

        finalPoint = finalPoint + point;

        this.logPoint(finalPoint, pronostique);
      }

      // Round of 32 & Round of 16
      if (game.phase === 'Round of 32' || game.phase === 'Round of 16') {
        let winnerPoint;
        let fulltimePoint;
        (game.winner_draw === winner_draw) ? winnerPoint = winner_point : winnerPoint = 0;
        (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b)) ? fulltimePoint = parseInt(fulltime_point) : fulltimePoint = 0;

        finalPoint = finalPoint + winnerPoint + fulltimePoint;
        this.logPoint(finalPoint, pronostique);
      }

      // Quarter-finals, Semi-finals, Third Place, Final
      if (['Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(game.phase)) {
        let winnerPoint;
        let fulltimePoint;
        let halftimePoint;
        let scorerPoint;
        let gamescorers;

        if (game.scorers) {
          gamescorers = this.returnScorersObj(game.scorers);
        }

        (game.winner_draw === winner_draw) ? winnerPoint = winner_point : winnerPoint = 0;
        (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b)) ? fulltimePoint = parseInt(fulltime_point) : fulltimePoint = 0;
        (parseInt(game.halftime_a) === parseInt(halftime_a) && parseInt(game.halftime_b) === parseInt(halftime_b)) ? halftimePoint = parseInt(halftime_point) : halftimePoint = 0;
        (gamescorers?.includes(scorers)) ? scorerPoint = scorer_point : scorerPoint = 0;

        finalPoint = finalPoint + halftimePoint + winnerPoint + fulltimePoint + scorerPoint;

        this.logPoint(finalPoint, pronostique);
      }
    }

    return finalPoint;
  }

  private logPoint(finalPoint: any, pronostique?: any) {
    // if(pronostique.user === 'iml-dv') {
    //   console.log(finalPoint, pronostique);
    // }
  }

  private returnScorersObj(scorersVal: any): string[] {
    if (!scorersVal) return [];
    if (Array.isArray(scorersVal)) {
      return scorersVal.map(e => e.player?.name || e.scorer?.name).filter(Boolean);
    }
    if (typeof scorersVal === 'string') {
      const trimmed = scorersVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map(e => e.player?.name || e.scorer?.name).filter(Boolean);
          }
        } catch (e) {
          // Fall back to split if JSON parse fails
        }
      }
      return trimmed.split(',').map(name => name.trim());
    }
    return [];
  }

  private updateRanking(rankingObj: any[]): void {
    // Sort the array by point in descending order, and then by key for consistency
    rankingObj.sort((a, b) => {
      if (b.point !== a.point) {
        return b.point - a.point; // Sort by point descending
      } else {
        return a.key.localeCompare(b.key); // If points are the same, sort by key ascending
      }
    });

    // Add rank to each object
    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) {
        rank = index + 1; // Update rank only if the current point is different from the previous
      }
      obj.rank = rank;
      obj.status = 'published';
    });

    let token = this.rankingToken;

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      this.pronosticsRankingsApiService.getRankings('', httpOptions).subscribe({
        next: (response) => {
          const list = response?.data || response || [];
          
          rankingObj.forEach(player => {
            const rankingRow = {
              key: player.key,
              point: player.point,
              rank: player.rank,
              status: 'published'
            };

            const existingRow = list.find((item: any) => item.key === player.key);
            if (existingRow) {
              this.pronosticsRankingsApiService.updateRanking(existingRow.id, rankingRow, httpOptions).subscribe({});
            } else {
              this.pronosticsRankingsApiService.createRanking(rankingRow, httpOptions).subscribe({});
            }
          });

          // Delete rows for users who no longer have rankings/predictions
          list.forEach((existingItem: any) => {
            const stillActive = rankingObj.some(player => player.key === existingItem.key);
            if (!stillActive) {
              this.pronosticsRankingsApiService.deleteRanking(existingItem.id, httpOptions).subscribe({});
            }
          });
        },
        error: (error) => {}
      });
    }
  }

  private calcBracketPoint(bracket: any, bareme: any, bonusFinalist: number, totalBrackets: number) {
    if (this.bracketResult) {
      let point = 0;

      // 16eme_de_finale (Round of 32): 16 matches (winner_r32_1 to winner_r32_16)
      const pointsR32 = bareme['16eme_de_finale'] || 10;
      for (let i = 1; i <= 16; i++) {
        const pred = bracket[`winner_r32_${i}`];
        const actual = this.bracketResult[`winner_r32_${i}`];
        if (pred && actual && pred === actual) {
          point += pointsR32;
        }
      }

      // 8eme_de_finale (Round of 16): 8 matches (winner_r16_1 to winner_r16_8)
      const pointsR16 = bareme['8eme_de_finale'] || 20;
      for (let i = 1; i <= 8; i++) {
        const pred = bracket[`winner_r16_${i}`];
        const actual = this.bracketResult[`winner_r16_${i}`];
        if (pred && actual && pred === actual) {
          point += pointsR16;
        }
      }

      // quart_de_finale (Quarter-finals): 4 matches (winner_r4_1 to winner_r4_4)
      const pointsR4 = bareme['quart_de_finale'] || 30;
      for (let i = 1; i <= 4; i++) {
        const pred = bracket[`winner_r4_${i}`];
        const actual = this.bracketResult[`winner_r4_${i}`];
        if (pred && actual && pred === actual) {
          point += pointsR4;
        }
      }

      // demi_finale (Semi-finals): 2 matches (winner_semi_1, winner_semi_2)
      const pointsSemi = bareme['demi_finale'] || 40;
      for (let i = 1; i <= 2; i++) {
        const pred = bracket[`winner_semi_${i}`];
        const actual = this.bracketResult[`winner_semi_${i}`];
        if (pred && actual && pred === actual) {
          point += pointsSemi;
        }
      }

      // finale (Champion): 1 match (winner_wc)
      const pointsFinale = bareme['finale'] || 100;
      const predWc = bracket[`winner_wc`];
      const actualWc = this.bracketResult[`winner_wc`];
      if (predWc && actualWc && predWc === actualWc) {
        point += pointsFinale;
      }

      // bonus_equipe_finale (Finalists bonus): 75 points per team
      const actualFinalists = [
        this.bracketResult.winner_semi_1,
        this.bracketResult.winner_semi_2
      ].filter(team => team && team !== 'À déterminer');

      const predFinalists = [
        bracket.winner_semi_1,
        bracket.winner_semi_2
      ].filter(team => team && team !== 'À déterminer');

      predFinalists.forEach(predTeam => {
        if (actualFinalists.includes(predTeam)) {
          point += bonusFinalist;
        }
      });

      this.bracketRankingObj.push({
        user: bracket.user,
        point: point
      });

      if (this.bracketRankingObj.length === totalBrackets) {
        this.updateBracketRanking(this.bracketRankingObj);
      }
    }
  }

  private updateBracketRanking(rankingObj: any[]): void {
    // Sort the array by point in descending order, and then by user for consistency
    rankingObj.sort((a, b) => {
      if (b.point !== a.point) {
        return b.point - a.point;
      } else {
        return a.user.localeCompare(b.user);
      }
    });

    // Add rank to each object
    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) {
        rank = index + 1;
      }
      obj.rank = rank;
      obj.status = 'published';
    });

    let rankingData = {
      status: 'published',
      ranking_json: rankingObj
    };

    let token = this.rankingToken;

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      this.bracketRankingsApiService.getRankings('', httpOptions).subscribe({
        next: (response) => {
          const list = response?.data || response || [];
          if (list.length > 0) {
            this.bracketRankingsApiService.updateRankings(list[0].id, rankingData, httpOptions).subscribe({
              next: () => {},
              error: (err) => {
                console.error('Failed to update bracket rankings:', err);
              }
            });
          } else {
            this.bracketRankingsApiService.createRankings(rankingData, httpOptions).subscribe({
              next: () => {},
              error: (err) => {
                console.error('Failed to create bracket rankings:', err);
              }
            });
          }
        },
        error: (error) => {
          console.error('Failed to retrieve bracket rankings:', error);
        }
      });
    }
  }
}
