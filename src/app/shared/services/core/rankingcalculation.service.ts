import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, groupBy, mergeMap, toArray, reduce } from 'rxjs/operators';
import { CookieService } from 'ngx-cookie-service';
import { MatchesService } from '../content/matches.service';
import { Matches } from '../../contracts/matches.contract';
import { Pronostiques, pronostiquesApiData } from '../../contracts/pronostiques.contract';
import { PredictionsService } from '../games/predictions.service';
import { AuthService } from './auth.service';

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

  private http = inject(HttpClient);
  private cookieService = inject(CookieService);
  private matchService = inject(MatchesService);
  private predictionService = inject(PredictionsService);
  private authService = inject(AuthService);
  private rankingToken!: string;
  private $pronostiques!: Observable<any>;
  private bracketRankingObj: any = [];
  private bracketResult!: any;

  private rankingBot = {
    'email': 'ranking.bot@infomil.mu',
    'password': 'infomil'
  }

  getCurrentrankings(): Observable<any> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/pronostiques_rankings`).pipe(
      map(response => response.data));
  }

  getBracketRankings(): Observable<any> {
    return this.http.get<any>(`https://euro.omediainteractive.net/imleuro/items/bracket_rankings`).pipe(map(response=> response.data));
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
        this.getBracketResults().subscribe({
          next: (result)=>{
            this.bracketResult = result[0];

            this.getBrackets().subscribe({
              next: (brackets)=>{
                brackets.forEach((bracket: any) => {
                  this.calcBracketPoint(bracket);
                });
              }
            });
          }
        })
      }
    });


  }

  private getBrackets(): Observable<any> {
    return this.http.get<any>('https://euro.omediainteractive.net/imleuro/items/bracket').pipe(
      map(response => response.data));
  }

  private getBracketResults(): Observable<any> {
    return this.http.get<any>('https://euro.omediainteractive.net/imleuro/items/bracket_result').pipe(
      map(response => response.data));
  }

  private getUsersPronostiques(token: string): Observable<any> {
    let httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      })
    }

    return this.http.get<pronostiquesApiData>(`https://euro.omediainteractive.net/imleuro/items/pronostiques`, httpOptions).pipe(
      map(response => response.data),
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

  private calcRanking(pronostiques: any):void {


    this.getMatchesPlayed().subscribe({
      next: (playedMatches: any)=>{
        let rankingObj: any[] = [];
        let resultMatches = playedMatches;
        let keys = Object.keys(pronostiques);

        keys.forEach((key) => {
            let point = 0;
            pronostiques[key].forEach((prono: any) => {
                point = this.calcResult(prono.game_id, prono, resultMatches) + point;
            });

            rankingObj.push({key, point});
        });

        this.updateRanking(rankingObj);
      }
    })
  }


  private getMatchesPlayed():Observable<Matches[]> {
    return this.matchService.getPlayedMatches();
  }

  private calcResult(gameId: any, pronostique: any, results: any): number{



    let gameIndex = parseInt(pronostique.game_id) - 1;
    let finalPoint: number = 0;

    if(results[gameIndex]){
      let game = results[gameIndex];

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
      if(game.phase === 'Group Stage'){
        let point;

        (game.winner_draw === winner_draw)? point = winner_point : point = 0;

        finalPoint = finalPoint + point;

        this.logPoint(finalPoint, pronostique);
      }

      // First Game
      if(game.phase === 'Group Stage' && game.id === 1 ){
        let point;
        (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b))? point = parseInt(fulltime_point) : point = 0;

        finalPoint = finalPoint + point;

        this.logPoint(finalPoint, pronostique);
      }

      // Round of 16
      if(game.phase === 'Round of 16') {
        let winnerPoint;
        let fulltimePoint;
        (game.winner_draw === winner_draw)? winnerPoint = winner_point : winnerPoint = 0;
        (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b))? fulltimePoint = parseInt(fulltime_point) : fulltimePoint = 0;

        finalPoint = finalPoint + winnerPoint + fulltimePoint;
        this.logPoint(finalPoint, pronostique);
      }

      // Quarter finals
      if(game.phase === 'Quarter-finals' || game.phase === 'Semi-finals' || game.phase === 'Final'){


        let winnerPoint;
        let fulltimePoint;
        let halftimePoint;
        let scorerPoint;
        let gamescorers;

        if(game.scorers) {
          gamescorers = this.returnScorersObj(game.scorers);
        }

        (game.winner_draw === winner_draw)? winnerPoint = winner_point : winnerPoint = 0;
        (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b))? fulltimePoint = parseInt(fulltime_point) : fulltimePoint = 0;
        (parseInt(game.halftime_a) === parseInt(halftime_a) && parseInt(game.halftime_b) === parseInt(halftime_b))? halftimePoint = parseInt(halftime_point) : halftimePoint = 0;
        (gamescorers?.includes(scorers))? scorerPoint = scorer_point: scorerPoint = 0;

        finalPoint = finalPoint + halftimePoint + winnerPoint + fulltimePoint + scorerPoint;

        this.logPoint(finalPoint, pronostique);
      }
    }

    return finalPoint;
  }

  private logPoint(finalPoint: any, pronostique?: any){
    // if(pronostique.user === 'iml-dv') {
    //   console.log(finalPoint, pronostique);
    // }
  }

  private returnScorersObj(scorersList: string){
    return scorersList.split(',').map(name => name.trim());
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
      obj.status = 'published'
    });


    let rankingData = {
      status: 'published',
      ranking_json: rankingObj
    }

    let token = this.rankingToken;

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      this.http.post(`https://euro.omediainteractive.net/imleuro/items/pronostiques_rankings`, rankingData, httpOptions).subscribe({
        next: (response)=>{
          console.log(response);
        },
        error: (error)=>{
          throw (error.msg)
        }
      });
    }
  }

  private calcBracketPoint(bracket: any) {
    if(this.bracketResult){
      // console.log(bracket);
      // console.log(this.bracketResult);

      let point = 0;

      let pointR16_1;
      (bracket.winner_r16_1 === this.bracketResult.winner_r16_1)? pointR16_1 = this.bracketResult.point_r16_1 : pointR16_1 = 0;

      let pointR16_2;
      (bracket.winner_r16_2 === this.bracketResult.winner_r16_2)? pointR16_2 = this.bracketResult.point_r16_2 : pointR16_2 = 0;

      let pointR16_3;
      (bracket.winner_r16_3 === this.bracketResult.winner_r16_3)? pointR16_3 = this.bracketResult.point_r16_3 : pointR16_3 = 0;

      let pointR16_4;
      (bracket.winner_r16_4 === this.bracketResult.winner_r16_4)? pointR16_4 = this.bracketResult.point_r16_4 : pointR16_4 = 0;

      let pointR16_5;
      (bracket.winner_r16_5 === this.bracketResult.winner_r16_5)? pointR16_5 = this.bracketResult.point_r16_5 : pointR16_5 = 0;

      let pointR16_6;
      (bracket.winner_r16_6 === this.bracketResult.winner_r16_6)? pointR16_6 = this.bracketResult.point_r16_6 : pointR16_6 = 0;

      let pointR16_7;
      (bracket.winner_r16_7 === this.bracketResult.winner_r16_7)? pointR16_7 = this.bracketResult.point_r16_7 : pointR16_7 = 0;

      let pointR16_8;
      (bracket.winner_r16_8 === this.bracketResult.winner_r16_8)? pointR16_8 = this.bracketResult.point_r16_8 : pointR16_8 = 0;

      let pointR4_1;
      (bracket.winner_r4_1 === this.bracketResult.winner_r4_1)? pointR4_1 = this.bracketResult.point_quarter_1 : pointR4_1 = 0;

      let pointR4_2;
      (bracket.winner_r4_2 === this.bracketResult.winner_r4_2)? pointR4_2 = this.bracketResult.point_quarter_2 : pointR4_2 = 0;

      let pointR4_3;
      (bracket.winner_r4_3 === this.bracketResult.winner_r4_3)? pointR4_3 = this.bracketResult.point_quarter_3 : pointR4_3 = 0;

      let pointR4_4;
      (bracket.winner_r4_4 === this.bracketResult.winner_r4_4)? pointR4_4= this.bracketResult.point_quarter_4 : pointR4_4 = 0;

      let pointR2_1;
      (bracket.winner_semi_1 === this.bracketResult.winner_semi_1)? pointR2_1= this.bracketResult.point_semi_1 : pointR2_1 = 0;

      let pointR2_2;
      (bracket.winner_semi_2 === this.bracketResult.winner_semi_2)? pointR2_2= this.bracketResult.point_semi_2 : pointR2_2 = 0;

      let pointWinnerEuro;
      (bracket.winner_euro === this.bracketResult.winner_euro)? pointWinnerEuro = this.bracketResult.point_final : pointWinnerEuro = 0;

      point = pointR16_1 + pointR16_2 + pointR16_3 + pointR16_4 + pointR16_5 + pointR16_6 + pointR16_7 + pointR16_8 + pointR4_1 + pointR4_2 + pointR4_3 + pointR4_4 + pointR2_1 + pointR2_2 + pointWinnerEuro;


      this.bracketRankingObj.push({
        user: bracket.user,
        point: point
      })

      if(this.bracketRankingObj.length === 45){
        this.updateBracketRanking(this.bracketRankingObj);
      }
    }
  }

  private updateBracketRanking(rankingObj: any[]): void {
    // Sort the array by point in descending order, and then by key for consistency
    rankingObj.sort((a, b) => {
      if (b.point !== a.point) {
          return b.point - a.point; // Sort by point descending
      } else {
          return a.user.localeCompare(b.user); // If points are the same, sort by key ascending
      }
    });

    // Add rank to each object
    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) {
          rank = index + 1; // Update rank only if the current point is different from the previous
      }
      obj.rank = rank;
      obj.status = 'published'
    });


    let rankingData = {
      status: 'published',
      ranking_json: rankingObj
    }

    let token = this.rankingToken;

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      this.http.post(`https://euro.omediainteractive.net/imleuro/items/bracket_rankings`, rankingData, httpOptions).subscribe({
        next: (response)=>{
          console.log(response);
        },
        error: (error)=>{
          throw (error.msg)
        }
      });
    }
  }
}
