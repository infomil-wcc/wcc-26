import { Routes } from '@angular/router';

export const HOMEPAGE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/homepage.component').then(m => m.HomepageComponent)
  }
];
