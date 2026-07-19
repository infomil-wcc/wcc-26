import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StateService } from '../services/core/state.service';
import { map, take } from 'rxjs/operators';

export const adminGuard: CanActivateFn = (route, state) => {
  const stateService = inject(StateService);
  const router = inject(Router);

  return stateService.userState.pipe(
    take(1),
    map(user => {
      if (user && user.role === 'Administrator') {
        return true;
      }
      router.navigate(['/accueil']);
      return false;
    })
  );
};
