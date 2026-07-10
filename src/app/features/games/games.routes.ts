import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const GAMES_ROUTES: Routes = [
  {
    path: 'meilleur-buteur',
    canActivate: [authGuard],
    loadComponent: () => import('./best-scorer/pages/best-scorer.component').then(m => m.BestScorerComponent)
  },
  {
    path: 'pronostics',
    canActivate: [authGuard],
    loadComponent: () => import('./pronostics/pages/pronostics.component').then(m => m.PronosticsComponent)
  },
  {
    path: 'bracket-challenge',
    canActivate: [authGuard],
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
