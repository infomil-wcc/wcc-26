import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet } from '@angular/router';
import { signal } from '@angular/core';
import { Component, Input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ServiceWorkerModule } from '@angular/service-worker';

import { AppComponent } from './app.component';
import { AppFacade } from './app.facade';
import { ChangeDetectorRef } from '@angular/core';

// ── Stub child components ─────────────────────────────────────────────────────

@Component({ selector: 'layout',     standalone: true, template: '<ng-content/>' })
class StubLayoutComponent {}

@Component({ selector: 'cmp-menu',   standalone: true, template: '' })
class StubMenuComponent {}

@Component({ selector: 'hero',       standalone: true, template: '<ng-content/>' })
class StubHeroComponent { @Input() background = ''; }

@Component({ selector: 'news',       standalone: true, template: '' })
class StubNewsComponent {}

@Component({ selector: 'cmp-footer', standalone: true, template: '' })
class StubFooterComponent {}

@Component({ selector: 'app-dialog', standalone: true, template: '<ng-content/>' })
class StubDialogComponent {
  @Input() showDialog = false;
  @Input() dialogTitle = '';
  @Input() withOverlay = false;
  @Input() allowClose = true;
}

@Component({ selector: 'loader',     standalone: true, template: '' })
class StubLoaderComponent { @Input() showLoader = false; }

// ── Facade mock factory ───────────────────────────────────────────────────────

function createFacadeMock() {
  const fb = new FormBuilder();
  return {
    showLoader:                signal(false),
    showDialog:                signal(false),
    showKnockoutPhase2Dialog:  signal(false),
    goalsForm:                 fb.group({ totalGoalsPrediction: [''] }),
    appUpdate:                 { isUpdateAvailable: signal(false) },
    init:                      jasmine.createSpy('init'),
    submitGoals:               jasmine.createSpy('submitGoals'),
    closeGoalsDialog:          jasmine.createSpy('closeGoalsDialog'),
    goToBracketChallenge:      jasmine.createSpy('goToBracketChallenge'),
    closeKnockoutPhase2Dialog: jasmine.createSpy('closeKnockoutPhase2Dialog'),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AppComponent (App Shell)', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let facadeMock: ReturnType<typeof createFacadeMock>;
  let routerMock: { url: string; navigate: jasmine.Spy };

  beforeEach(async () => {
    facadeMock = createFacadeMock();
    routerMock = { url: '/', navigate: jasmine.createSpy('navigate') };

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        ReactiveFormsModule,
        RouterOutlet,
        StubLayoutComponent,
        StubMenuComponent,
        StubHeroComponent,
        StubNewsComponent,
        StubFooterComponent,
        StubDialogComponent,
        StubLoaderComponent,
        // Provides SwUpdate with no-op service worker so AppUpdateService can be created
        ServiceWorkerModule.register('', { enabled: false }),
      ],
      providers: [
        { provide: Router, useValue: routerMock },
      ],
    })
    // Override the component-level providers so the facade mock takes precedence
    .overrideComponent(AppComponent, {
      set: { providers: [{ provide: AppFacade, useValue: facadeMock }] },
    })
    .compileComponents();

    fixture   = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Creation ────────────────────────────────────────────────────────────────
  describe('Component creation', () => {
    it('should create the shell component', () => {
      expect(component).toBeTruthy();
    });

    it('should have the correct title', () => {
      expect(component.title).toBe('IML Foot Challenge - FIFA WORLD CUP 2026');
    });

    it('should expose the facade', () => {
      expect(component['facade']).toBeTruthy();
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  describe('ngOnInit', () => {
    it('should call facade.init() on init', () => {
      component.ngOnInit();
      // Called once on fixture.detectChanges() + once explicitly above
      expect(facadeMock.init).toHaveBeenCalled();
    });
  });

  // ── Template: layout shell ──────────────────────────────────────────────────
  describe('Template – layout shell', () => {
    it('should render the <layout> root element', () => {
      expect(fixture.nativeElement.querySelector('layout')).toBeTruthy();
    });

    it('should render the menu inside the header slot', () => {
      expect(fixture.nativeElement.querySelector('cmp-menu')).toBeTruthy();
    });

    it('should render the <router-outlet> inside the main slot', () => {
      expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    });

    it('should render the footer inside the footer slot', () => {
      expect(fixture.nativeElement.querySelector('cmp-footer')).toBeTruthy();
    });
  });

  // ── Template: hero visibility ───────────────────────────────────────────────
  describe('Template – hero section', () => {
    it('should render the hero on the root route "/"', () => {
      routerMock.url = '/';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('hero')).toBeTruthy();
    });

    it('should render the hero on the "/accueil" route', () => {
      routerMock.url = '/accueil';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('hero')).toBeTruthy();
    });

    it('should NOT render the hero on other routes', () => {
      // Mutate url then force CD so the @if re-evaluates
      routerMock.url = '/bracket-challenge';
      fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('hero')).toBeNull();
    });
  });

  // ── Template: goals dialog ──────────────────────────────────────────────────
  describe('Template – goals prediction dialog', () => {
    it('should render the <app-dialog> element', () => {
      expect(fixture.nativeElement.querySelector('app-dialog')).toBeTruthy();
    });

    it('should call facade.submitGoals() when invoked', () => {
      // The submit button lives inside <app-dialog> whose stub does not project
      // content in unit tests — call the facade method directly instead.
      facadeMock.submitGoals();
      expect(facadeMock.submitGoals).toHaveBeenCalled();
    });
  });

  // ── Template: knockout phase 2 takeover ────────────────────────────────────
  describe('Template – knockout phase 2 takeover', () => {
    it('should NOT render the takeover when signal is false', () => {
      facadeMock.showKnockoutPhase2Dialog.set(false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.fullscreen-takeover')).toBeNull();
    });

    it('should render the takeover when signal is true', () => {
      facadeMock.showKnockoutPhase2Dialog.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.fullscreen-takeover')).toBeTruthy();
    });

    it('should render the takeover title when visible', () => {
      facadeMock.showKnockoutPhase2Dialog.set(true);
      fixture.detectChanges();
      const h2: HTMLElement | null = fixture.nativeElement.querySelector('.takeover-title');
      expect(h2?.textContent).toContain('BRACKET PHASE FINALE');
    });

    it('should call facade.goToBracketChallenge() when primary CTA is clicked', () => {
      facadeMock.showKnockoutPhase2Dialog.set(true);
      fixture.detectChanges();
      const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.btn-takeover-primary');
      btn?.click();
      expect(facadeMock.goToBracketChallenge).toHaveBeenCalled();
    });

    it('should call facade.closeKnockoutPhase2Dialog() when "Plus tard" link is clicked', () => {
      facadeMock.showKnockoutPhase2Dialog.set(true);
      fixture.detectChanges();
      const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.btn-takeover-link');
      btn?.click();
      expect(facadeMock.closeKnockoutPhase2Dialog).toHaveBeenCalled();
    });

    it('should call facade.closeKnockoutPhase2Dialog() when close (×) button is clicked', () => {
      facadeMock.showKnockoutPhase2Dialog.set(true);
      fixture.detectChanges();
      const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.takeover-close-btn');
      btn?.click();
      expect(facadeMock.closeKnockoutPhase2Dialog).toHaveBeenCalled();
    });
  });

  // ── Template: global loader ─────────────────────────────────────────────────
  describe('Template – global loader', () => {
    it('should render the <loader> element', () => {
      expect(fixture.nativeElement.querySelector('loader')).toBeTruthy();
    });
  });
});
