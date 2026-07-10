import { Routes } from '@angular/router';

export const GAMES_ROUTES: Routes = [
  {
    path: 'meilleur-buteur',
    loadComponent: () => import('./best-scorer/pages/best-scorer.component').then(m => m.BestScorerComponent)
  },
  {
    path: 'pronostics',
    loadComponent: () => import('./pronostics/pages/pronostics.component').then(m => m.PronosticsComponent)
  },
  {
    path: 'bracket-challenge',
    loadComponent: () => import('./bracket-challenge/pages/bracket-challenge.component').then(m => m.BracketChallengeComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./leaderboard/pages/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'leaderboard/scoresheet/:id',
    loadComponent: () => import('./leaderboard/pages/scoresheet/scoresheet.component').then(m => m.ScoresheetComponent)
  }
];
