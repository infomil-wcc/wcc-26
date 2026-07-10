import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchComponent } from './match.component';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StateService } from '../../core/services/core/state.service';
import { AuthService } from '../../core/services/core/auth.service';

describe('MatchComponent', () => {
  let component: MatchComponent;
  let fixture: ComponentFixture<MatchComponent>;

  beforeEach(async () => {
    const mockStateService = {
      isMobile: signal(false)
    };

    const mockAuthService = {
      isLoggedIn: signal(true)
    };

    const mockActivatedRoute = {
      snapshot: { paramMap: { get: () => '1' } }
    };

    await TestBed.configureTestingModule({
      imports: [MatchComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MatchComponent);
    component = fixture.componentInstance;
    
    // Provide a dummy match input
    fixture.componentRef.setInput('match', {
      id: '1',
      team_a: 'Team A',
      team_b: 'Team B',
      team_a_img: 'img_a',
      team_b_img: 'img_b',
      match_date: '2026-06-11 16:00:00'
    });
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
