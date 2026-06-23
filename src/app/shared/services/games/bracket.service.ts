import { Injectable, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { CookieService } from '../core/cookie.service';
import { BracketApiService } from '../api/bracket-api.service';

@Injectable({
  providedIn: 'root'
})
export class BracketService {

  private bracketApiService = inject(BracketApiService);
  private cookieService = inject(CookieService);

  getUserBracket(user: string | null): Observable<any> {
    let token = this.cookieService.get('currentToken');

    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.bracketApiService.getBrackets(`?filter[user]=${user}`, httpOptions).pipe(
        map(response => response.data)
      );
    } else {
      return throwError('No token found');
    }
  }

  getBrackets(): Observable<any> {
      return this.bracketApiService.getBrackets().pipe(
      map(response => response.data)
    );
  }

  postBracket(bracket: any): Observable<any> {
    let token = this.cookieService.get('currentToken');
  
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };
      return this.bracketApiService.createBracket(bracket, httpOptions);
    } else {
      return throwError('No token found');
    }
  }

  deleteBracket(id: string): Observable<any> {
    let token = this.cookieService.get('currentToken');
    if (token) {
      let httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
      };

      return this.bracketApiService.deleteBracket(id, httpOptions);
    } else {
      return throwError('No token found');
    }
  }


  calculateGroupStandings(matches: any[]): any {
    const groups: { [key: string]: any } = {};
    matches.forEach(m => {
      const id = parseInt(m.id || m.game_id, 10);
      if (m.phase === 'Group Stage' || (id >= 1 && id <= 72)) {
        const grp = m.group || 'Group A';
        if (!groups[grp]) {
          groups[grp] = {};
        }
        
        const teams = [m.team_a, m.team_b];
        teams.forEach(t => {
          if (t && !groups[grp][t]) {
            groups[grp][t] = {
              name: t,
              group: grp,
              points: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              played: 0
            };
          }
        });

        const scoreA = m.fulltime_a !== null && m.fulltime_a !== undefined ? parseInt(m.fulltime_a, 10) : null;
        const scoreB = m.fulltime_b !== null && m.fulltime_b !== undefined ? parseInt(m.fulltime_b, 10) : null;

        if (scoreA !== null && scoreB !== null && groups[grp][m.team_a] && groups[grp][m.team_b]) {
          groups[grp][m.team_a].played += 1;
          groups[grp][m.team_b].played += 1;
          groups[grp][m.team_a].goalsFor += scoreA;
          groups[grp][m.team_a].goalsAgainst += scoreB;
          groups[grp][m.team_b].goalsFor += scoreB;
          groups[grp][m.team_b].goalsAgainst += scoreA;

          if (scoreA > scoreB) {
            groups[grp][m.team_a].points += 3;
          } else if (scoreB > scoreA) {
            groups[grp][m.team_b].points += 3;
          } else {
            groups[grp][m.team_a].points += 1;
            groups[grp][m.team_b].points += 1;
          }
        }
      }
    });

    const sortedGroups: { [key: string]: any[] } = {};
    Object.keys(groups).forEach(grp => {
      const teams = Object.values(groups[grp]);
      teams.forEach((t: any) => {
        t.goalDifference = t.goalsFor - t.goalsAgainst;
      });
      teams.sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.name.localeCompare(b.name);
      });
      sortedGroups[grp] = teams;
    });

    return sortedGroups;
  }

  generateRoundOf32FromGroups(matches: any[], flags: any[] = []): any[] {
    const standings = this.calculateGroupStandings(matches);
    const getTeamByRank = (groupLetter: string, rankIndex: number): any => {
      const grp = standings[`Group ${groupLetter}`];
      if (grp && grp[rankIndex]) {
        const teamName = grp[rankIndex].name;
        const flagObj = flags.find((f: any) => f.name.toLowerCase() === teamName.toLowerCase());
        return {
          name: teamName,
          group: `Group ${groupLetter}`,
          rank: rankIndex === 0 ? '1er' : (rankIndex === 1 ? '2ème' : '3ème'),
          flagUrl: flagObj?.flag_url || flagObj?.url || 'assets/flags/unknown.png',
          flagId: flagObj?.iso?.toLowerCase() || teamName.substring(0, 2).toLowerCase()
        };
      }
      return {
        name: `À déterminer`,
        group: `Group ${groupLetter}`,
        rank: '',
        flagUrl: 'assets/flags/unknown.png',
        flagId: 'tbc'
      };
    };

    const allThirds: any[] = [];
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(letter => {
      const grp = standings[`Group ${letter}`];
      if (grp && grp[2]) {
        const teamName = grp[2].name;
        const flagObj = flags.find((f: any) => f.name.toLowerCase() === teamName.toLowerCase());
        allThirds.push({
          name: teamName,
          group: `Group ${letter}`,
          rank: '3ème',
          points: grp[2].points,
          goalDifference: grp[2].goalDifference,
          goalsFor: grp[2].goalsFor,
          flagUrl: flagObj?.flag_url || flagObj?.url || 'assets/flags/unknown.png',
          flagId: flagObj?.iso?.toLowerCase() || teamName.substring(0, 2).toLowerCase()
        });
      }
    });

    allThirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    const bestEightThirds = allThirds.slice(0, 8);
    while (bestEightThirds.length < 8) {
      bestEightThirds.push({
        name: 'À déterminer',
        group: '',
        points: 0,
        goalDifference: 0,
        goalsFor: 0,
        flagUrl: 'assets/flags/unknown.png',
        flagId: 'tbc'
      });
    }

    const slotWinners = ['Group E', 'Group I', 'Group A', 'Group L', 'Group D', 'Group G', 'Group B', 'Group K'];
    const assignedThirds = new Array(8);
    const used = new Set<number>();

    const backtrack = (winnerIndex: number): boolean => {
      if (winnerIndex === 8) return true;
      const wGroup = slotWinners[winnerIndex];
      for (let i = 0; i < 8; i++) {
        if (!used.has(i)) {
          const third = bestEightThirds[i];
          if (third.group !== wGroup) {
            used.add(i);
            assignedThirds[winnerIndex] = third;
            if (backtrack(winnerIndex + 1)) return true;
            used.delete(i);
          }
        }
      }
      return false;
    };

    if (!backtrack(0)) {
      for (let i = 0; i < 8; i++) {
        assignedThirds[i] = bestEightThirds[i];
      }
    }

    const pairsMap: { [key: number]: any[] } = {
      73: [getTeamByRank('A', 1), getTeamByRank('B', 1)],
      74: [getTeamByRank('E', 0), assignedThirds[0]],
      75: [getTeamByRank('F', 0), getTeamByRank('C', 1)],
      76: [getTeamByRank('C', 0), getTeamByRank('F', 1)],
      77: [getTeamByRank('I', 0), assignedThirds[1]],
      78: [getTeamByRank('E', 1), getTeamByRank('I', 1)],
      79: [getTeamByRank('A', 0), assignedThirds[2]],
      80: [getTeamByRank('L', 0), assignedThirds[3]],
      81: [getTeamByRank('D', 0), assignedThirds[4]],
      82: [getTeamByRank('G', 0), assignedThirds[5]],
      83: [getTeamByRank('K', 1), getTeamByRank('L', 1)],
      84: [getTeamByRank('H', 0), getTeamByRank('J', 1)],
      85: [getTeamByRank('B', 0), assignedThirds[6]],
      86: [getTeamByRank('J', 0), getTeamByRank('H', 1)],
      87: [getTeamByRank('K', 0), assignedThirds[7]],
      88: [getTeamByRank('D', 1), getTeamByRank('G', 1)]
    };

    const r32Order = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
    const bracketPairs: any[] = [];
    r32Order.forEach(id => {
      const pair = pairsMap[id];
      if (pair) {
        bracketPairs.push(pair[0]);
        bracketPairs.push(pair[1]);
      }
    });

    return bracketPairs;
  }
}


