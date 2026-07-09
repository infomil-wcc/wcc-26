import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'accueil',
    pathMatch: 'full'
  },
  {
    path: 'accueil',
    loadComponent: () => import('./features/homepage/pages/homepage.component').then(m => m.HomepageComponent)
  },
  {
    path: 'les-matchs',
    loadComponent: () => import('./features/competition/games/pages/games.component').then(m => m.GamesComponent)
  },
  {
    path: 'les-equipes',
    loadComponent: () => import('./features/competition/teams/pages/teams.component').then(m => m.TeamsComponent)
  },
  {
    path: 'les-stades',
    loadComponent: () => import('./features/competition/stadiums/pages/stadiums.component').then(m => m.StadiumsComponent)
  },
  {
    path: 'statistiques',
    loadComponent: () => import('./features/competition/statistics/pages/statistics.component').then(m => m.StatisticsComponent)
  },
  {
    path: 'meilleur-buteur',
    loadComponent: () => import('./features/games/best-scorer/pages/best-scorer.component').then(m => m.BestScorerComponent)
  },
  {
    path: 'pronostics',
    loadComponent: () => import('./features/games/pronostics/pages/pronostics.component').then(m => m.PronosticsComponent)
  },
  // {
  //   path: 'bracket',
  //   loadComponent: () => import('./pages/games/bracket-knockout/bracket-knockout.component').then(m => m.BracketKnockoutComponent)
  // },
  // {
  //   path: 'bracket-challenge',
  //   loadComponent: () => import('./pages/games/bracket-challenge/bracket-challenge.component').then(m => m.BracketChallengeComponent)
  // },
  {
    path: 'quiz',
    loadComponent: () => import('./features/games/quiz/pages/quiz.component').then(m => m.QuizComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./features/games/leaderboard/pages/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'leaderboard/scoresheet/:id',
    loadComponent: () => import('./features/games/leaderboard/pages/scoresheet/scoresheet.component').then(m => m.ScoresheetComponent)
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/pages/faq.component').then(m => m.FaqComponent)
  },
  {
    path: 'game-rules',
    loadComponent: () => import('./features/game-rules/pages/game-rules.component').then(m => m.GameRulesComponent)
  },
  {
    path: 'les-groupes',
    loadComponent: () => import('./features/competition/group-standings/pages/group-standings.component').then(m => m.GroupStandingsComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent)
  }
];
