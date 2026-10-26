import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

/** Only signed-in readers reach the library. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!inject(SupabaseService).configured) return router.createUrlTree(['/setup']);
  if (auth.session()) return true;
  return router.createUrlTree(['/sign-in'], {
    queryParams: state.url && state.url !== '/' ? { next: state.url } : {},
  });
};

/** Sign-in and registration pages bounce signed-in readers to the library. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!inject(SupabaseService).configured) return router.createUrlTree(['/setup']);
  if (auth.session() && !auth.recovering()) return router.createUrlTree(['/']);
  return true;
};

export const configuredGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SupabaseService).configured ? router.createUrlTree(['/']) : true;
};
