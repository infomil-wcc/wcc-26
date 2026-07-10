import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameRulesComponent } from './game-rules.component';
import { GameRulesService } from '../../../../core/services/content/game-rules.service';
import { signal } from '@angular/core';

describe('GameRulesComponent', () => {
  let component: GameRulesComponent;
  let fixture: ComponentFixture<GameRulesComponent>;

  beforeEach(async () => {
    const mockGameRulesService = {
      gameRules: signal([])
    };

    await TestBed.configureTestingModule({
      imports: [GameRulesComponent],
      providers: [
        { provide: GameRulesService, useValue: mockGameRulesService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GameRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
