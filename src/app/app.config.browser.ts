import { ApplicationConfig, importProvidersFrom, isDevMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { routes } from './app.routes';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAnimations(),
    provideClientHydration(withEventReplay()),

    provideHttpClient(
      withFetch(),
      withInterceptors([cacheInterceptor])
    ),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    importProvidersFrom(DragDropModule),
  ]
};
