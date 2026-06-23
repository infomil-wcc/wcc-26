import { enableProdMode, importProvidersFrom, isDevMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Routes } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ServiceWorkerModule } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { cacheInterceptor } from './app/shared/services/core/cache.interceptor';

registerLocaleData(localeFr);

const routes: Routes = [
  {
    path: 'bracket-challenge',
    loadComponent: () => import('./app/pages/games/bracket-challenge/bracket-challenge.component').then(m => m.BracketChallengeComponent)
  }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
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
