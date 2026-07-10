import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { CookieService } from '../services/core/cookie.service';

export const authGuard: CanActivateFn = (route, state) => {
  const cookieService = inject(CookieService);
  const router = inject(Router);

  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const token = cookieService.get('currentToken');

  if (token) {
    return true;
  }

  // Not authenticated, redirect to home
  return router.createUrlTree(['/accueil']);
};
