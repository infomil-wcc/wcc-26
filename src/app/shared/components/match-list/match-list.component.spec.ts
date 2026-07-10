import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchListComponent } from './match-list.component';
import { signal } from '@angular/core';

describe('MatchListComponent', () => {
  let component: MatchListComponent;
  let fixture: ComponentFixture<MatchListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MatchListComponent);
    component = fixture.componentInstance;
    
    // Provide a dummy list of matches
    fixture.componentRef.setInput('matches', []);
    fixture.componentRef.setInput('title', 'Test');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
