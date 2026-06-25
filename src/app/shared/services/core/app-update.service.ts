import { Injectable, ApplicationRef, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // 1. Regularly poll the server for updates every 1 hour (optional but recommended)
    this.initPolling();

    // 2. Listen for when a new version is fully downloaded and ready
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        this.forceUpdate();
      });

    // 3. Handle unrecoverable states (e.g., if cache clearing deleted critical lazy-loaded chunks)
    this.swUpdate.unrecoverable.subscribe(() => {
      console.warn('App is in an unrecoverable state. Forcing clean reload...');
      window.location.reload();
    });
  }

  private initPolling() {

    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
    const everyHour$ = interval(60 * 60 * 1000);
    const poolOnceStable$ = concat(appIsStable$, everyHour$);

    poolOnceStable$.subscribe(() => {
      this.swUpdate.checkForUpdate().catch(err => console.error('Error checking for updates:', err));
    });
  }

  private forceUpdate() {

    this.swUpdate.activateUpdate().then(() => {
      // Force reload the page from the server to bypass any lingering browser cache
      window.location.reload();
    });
  }
}