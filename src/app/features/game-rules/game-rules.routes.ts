import { Routes } from '@angular/router';

export const GAME_RULES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/game-rules.component').then(m => m.GameRulesComponent)
  }
];
