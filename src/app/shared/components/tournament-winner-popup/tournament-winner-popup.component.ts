import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { MatchesService } from '../../services/content/matches.service';
import { RankingsService } from '../../services/content/rankings.service';
import { TeamsService } from '../../services/content/teams.service';
import { Matches } from '../../contracts/matches.contract';
import { NgClass, CommonModule } from '@angular/common';
// @ts-ignore
import * as confettiPkg from 'canvas-confetti';
const confetti = (confettiPkg as any).default || confettiPkg;

@Component({
  selector: 'app-tournament-winner-popup',
  templateUrl: './tournament-winner-popup.component.html',
  styleUrls: ['./tournament-winner-popup.component.scss'],
  standalone: true,
  imports: [NgClass, CommonModule]
})
export class TournamentWinnerPopupComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private matchesService = inject(MatchesService);
  private rankingsService = inject(RankingsService);
  private teamsService = inject(TeamsService);

  activeSlide: number = 0; // 0 = Winner, 1 = Leaderboard
  
  winningTeam: string | null = null;
  winningTeamFlag: string | null = null;
  
  topPlayers: any[] = [];
  
  isLoadingWinner = true;
  isLoadingLeaderboard = true;

  ngOnInit(): void {
    // 1. Fetch Winner
    this.matchesService.getMatchesByPhase('Final').subscribe(matches => {
      if (matches && matches.length > 0) {
        const finalMatch = matches[0];
        // Ensure the match is finished
        if (finalMatch.current_status?.toLowerCase() === 'finished' || finalMatch.played) {
          // Determine winner based on winner_draw or fulltime scores
          if (finalMatch.winner_draw === finalMatch.team_a) {
            this.winningTeam = finalMatch.team_a;
          } else if (finalMatch.winner_draw === finalMatch.team_b) {
            this.winningTeam = finalMatch.team_b;
          } else if (finalMatch.fulltime_a !== null && finalMatch.fulltime_b !== null) {
            if (finalMatch.fulltime_a > finalMatch.fulltime_b) this.winningTeam = finalMatch.team_a;
            else if (finalMatch.fulltime_b > finalMatch.fulltime_a) this.winningTeam = finalMatch.team_b;
          }
          
          if (this.winningTeam) {
            this.fetchFlag(this.winningTeam);
          }
        }
      }
      this.isLoadingWinner = false;
    });

    // 2. Fetch Leaderboard Top 3
    this.rankingsService.getPronosticsRankings().subscribe(rankings => {
      if (rankings && rankings.length > 0) {
        // Sort by points descending (or rank ascending)
        rankings.sort((a: any, b: any) => (a.rank || 1) - (b.rank || 1));
        this.topPlayers = rankings.slice(0, 3);
        
        // Ensure we always have exactly 3 for the podium logic to render gracefully
        while(this.topPlayers.length < 3) {
          this.topPlayers.push({ trigramme: '---', point: 0 });
        }
      }
      this.isLoadingLeaderboard = false;
    });

    // Fire initial confetti for the winner!
    setTimeout(() => this.fireConfetti(), 500);
  }

  fireConfetti(): void {
    if (this.activeSlide !== 0) return;
    
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#ff0055', '#4caf50', '#2196f3', '#673ab7'],
        zIndex: 10000
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#ff0055', '#4caf50', '#2196f3', '#673ab7'],
        zIndex: 10000
      });

      if (Date.now() < end && this.activeSlide === 0) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }

  fetchFlag(teamName: string): void {
    this.teamsService.getFlags().subscribe(flags => {
      const match = flags.find((f: any) => f.name === teamName);
      if (match) {
        this.winningTeamFlag = match.flag_url;
      }
    });
  }

  nextSlide(): void {
    if (this.activeSlide === 0) this.activeSlide = 1;
  }

  prevSlide(): void {
    if (this.activeSlide === 1) {
      this.activeSlide = 0;
      setTimeout(() => this.fireConfetti(), 300);
    }
  }

  setSlide(index: number): void {
    this.activeSlide = index;
    if (index === 0) {
      setTimeout(() => this.fireConfetti(), 300);
    }
  }

  closePopup(): void {
    this.close.emit();
  }
}
