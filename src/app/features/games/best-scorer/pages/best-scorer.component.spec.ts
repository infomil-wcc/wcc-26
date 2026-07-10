import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BestScorerComponent } from './best-scorer.component';
import { LoginComponent } from '../../../../features/auth/login.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('BestScorerComponent', () => {
  let component: BestScorerComponent;
  let fixture: ComponentFixture<BestScorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [ReactiveFormsModule, BestScorerComponent, LoginComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(BestScorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
