import { Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Service } from '@angular/core';

export type AppTheme = 'default' | 'fifa';

@Service()
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private currentTheme: AppTheme = 'default';

  private platformId = inject(PLATFORM_ID);

  constructor() {
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
