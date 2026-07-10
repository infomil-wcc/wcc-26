import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarStripComponent } from './calendar-strip.component';
import { StateService } from '../../../core/services/core/state.service';
import { MatchCountdownService } from '../../../core/services/games/match-countdown.service';
import { signal } from '@angular/core';

describe('CalendarStripComponent', () => {
  let component: CalendarStripComponent;
  let fixture: ComponentFixture<CalendarStripComponent>;

  beforeEach(async () => {
    const mockStateService = {
      isMobile: signal(false)
    };

    const mockCountdownService = {
      days: signal(0),
      hours: signal(0),
      minutes: signal(0),
      seconds: signal(0)
    };

    await TestBed.configureTestingModule({
      imports: [CalendarStripComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: MatchCountdownService, useValue: mockCountdownService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarStripComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
