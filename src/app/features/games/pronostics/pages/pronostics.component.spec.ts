import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PronosticsComponent } from './pronostics.component';

describe('PronosticsComponent', () => {
  let component: PronosticsComponent;
  let fixture: ComponentFixture<PronosticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [PronosticsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(PronosticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
