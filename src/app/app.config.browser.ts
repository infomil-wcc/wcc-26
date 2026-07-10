import { ApplicationConfig, importProvidersFrom, isDevMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { routes } from './app.routes';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAnimations(),
    provideClientHydration(withEventReplay()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.p-dark'
        }
      },
      license: "eyJpZCI6ImIyNzZkOTI5LWViNDMtNDBmNi1iYTMzLWQzNmQyOWE2ZmI0MCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODI4NzM4NDYsImV4cCI6MTgxNDQwOTg0Nn0.R0pBHpD6IKdwUY1ScagfO1gna44cPxfkClRAj1IQs8XTNgKZPFkmGAjtJoUx6m5uSO_beHmqrnmsNupAUEX5DQ"
    }),
    provideHttpClient(
      withFetch(),
      withInterceptors([cacheInterceptor])
    ),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    importProvidersFrom(DragDropModule),
  ]
};
