import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorViewComponent } from './error-view.component';

describe('ErrorViewComponent', () => {
  let component: ErrorViewComponent;
  let fixture: ComponentFixture<ErrorViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorViewComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorViewComponent);
    component = fixture.componentInstance;
    
    // Set inputs
    fixture.componentRef.setInput('message', 'Error');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
