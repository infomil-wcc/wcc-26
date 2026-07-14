import { Routes } from '@angular/router';

export const COMPETITION_ROUTES: Routes = [
  {
    path: 'les-matchs',
    loadComponent: () => import('./games/pages/games.component').then(m => m.GamesComponent)
  },
  {
    path: 'les-equipes',
    loadComponent: () => import('./teams/teams.component').then(m => m.TeamsComponent)
  },
  {
    path: 'les-stades',
    loadComponent: () => import('./stadiums/pages/stadiums.component').then(m => m.StadiumsComponent)
  },
  {
    path: 'statistiques',
    loadComponent: () => import('./statistics/pages/statistics.component').then(m => m.StatisticsComponent)
  },
  {
    path: 'les-groupes',
    loadComponent: () => import('./group-standings/pages/group-standings.component').then(m => m.GroupStandingsComponent)
  }
];
