import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'accueil',
    pathMatch: 'full'
  },
  {
    path: 'accueil',
    loadComponent: () => import('./pages/homepage/homepage.component').then(m => m.HomepageComponent)
  },
  {
    path: 'les-matchs',
    loadComponent: () => import('./pages/competition/games/games.component').then(m => m.GamesComponent)
  },
  {
    path: 'les-equipes',
    loadComponent: () => import('./pages/competition/teams/teams.component').then(m => m.TeamsComponent)
  },
  {
    path: 'les-stades',
    loadComponent: () => import('./pages/competition/stadiums/stadiums.component').then(m => m.StadiumsComponent)
  },
  {
    path: 'statistiques',
    loadComponent: () => import('./pages/competition/statistics/statistics.component').then(m => m.StatisticsComponent)
  },
  {
    path: 'meilleur-buteur',
    loadComponent: () => import('./pages/games/best-scorer/best-scorer.component').then(m => m.BestScorerComponent)
  },
  {
    path: 'pronostics',
    loadComponent: () => import('./pages/games/pronostics/pronostics.component').then(m => m.PronosticsComponent)
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
    loadComponent: () => import('./pages/games/quiz/quiz.component').then(m => m.QuizComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./pages/games/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'leaderboard/scoresheet/:id',
    loadComponent: () => import('./pages/games/leaderboard/scoresheet/scoresheet.component').then(m => m.ScoresheetComponent)
  },
  {
    path: 'faq',
    loadComponent: () => import('./pages/faq/faq.component').then(m => m.FaqComponent)
  },
  {
    path: 'game-rules',
    loadComponent: () => import('./pages/game-rules/game-rules.component').then(m => m.GameRulesComponent)
  },
  {
    path: 'les-groupes',
    loadComponent: () => import('./pages/competition/group-standings/group-standings.component').then(m => m.GroupStandingsComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent)
  }
];
