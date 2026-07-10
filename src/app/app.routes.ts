import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'accueil',
    pathMatch: 'full'
  },

  // ── Homepage ──────────────────────────────────────────────────────────────
  {
    path: 'accueil',
    loadChildren: () => import('@features/homepage/homepage.routes').then(m => m.HOMEPAGE_ROUTES)
  },

  // ── Competition ───────────────────────────────────────────────────────────
  {
    path: '',
    loadChildren: () => import('@features/competition/competition.routes').then(m => m.COMPETITION_ROUTES)
  },

  // ── Games ─────────────────────────────────────────────────────────────────
  {
    path: '',
    loadChildren: () => import('@features/games/games.routes').then(m => m.GAMES_ROUTES)
  },

  // ── Info pages ────────────────────────────────────────────────────────────
  {
    path: 'faq',
    loadChildren: () => import('@features/faq/faq.routes').then(m => m.FAQ_ROUTES)
  },
  {
    path: 'game-rules',
    loadChildren: () => import('@features/game-rules/game-rules.routes').then(m => m.GAME_RULES_ROUTES)
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent)
  }
];
