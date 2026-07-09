import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme = 'default' | 'fifa';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private currentTheme: AppTheme = 'default';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.initTheme();
  }

  private initTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.THEME_KEY) as AppTheme;
      if (savedTheme) {
        this.setTheme(savedTheme);
      } else {
        this.setTheme('default');
      }
    }
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    if (isPlatformBrowser(this.platformId)) {
      if (theme === 'default') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      localStorage.setItem(this.THEME_KEY, theme);
    }
  }

  getTheme(): AppTheme {
    return this.currentTheme;
  }
}
