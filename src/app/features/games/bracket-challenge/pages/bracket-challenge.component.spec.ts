import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BracketChallengeComponent } from './bracket-challenge.component';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StateService } from '../../../../core/services/core/state.service';
import { BracketService } from '../../../../core/services/games/bracket.service';

describe('BracketChallengeComponent', () => {
  let component: BracketChallengeComponent;
  let fixture: ComponentFixture<BracketChallengeComponent>;

  beforeEach(async () => {
    const mockStateService = {
      isMobile: signal(false)
    };

    const mockBracketService = {
      bracketData: signal(null),
      saveBracket: vi.fn()
    };

    const mockActivatedRoute = {
      snapshot: { paramMap: { get: () => '1' } }
    };

    await TestBed.configureTestingModule({
      imports: [BracketChallengeComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: BracketService, useValue: mockBracketService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BracketChallengeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
