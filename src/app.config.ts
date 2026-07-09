import { enableProdMode, importProvidersFrom, isDevMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Routes, withPreloading, PreloadAllModules } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ServiceWorkerModule } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { AppComponent } from './app/app.component';
import { cacheInterceptor } from './app/core/interceptors/cache.interceptor';

import { routes } from './app/app.routes';

registerLocaleData(localeFr);

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAnimations(),
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
      withInterceptors([cacheInterceptor])
    ),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    importProvidersFrom(
      DragDropModule,
      ServiceWorkerModule.register('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000'
      })
    )
  ]
}).catch(err => console.error(err));
