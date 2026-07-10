import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TacticalLineupComponent } from './tactical-lineup.component';

describe('TacticalLineupComponent', () => {
  let component: TacticalLineupComponent;
  let fixture: ComponentFixture<TacticalLineupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TacticalLineupComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TacticalLineupComponent);
    component = fixture.componentInstance;
    
    fixture.componentRef.setInput('match', {
      id: '1',
      team_a: 'Team A',
      team_b: 'Team B',
      team_a_img: 'img_a',
      team_b_img: 'img_b',
      match_date: '2026-06-11 16:00:00'
    });
    fixture.componentRef.setInput('lineups', null);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
