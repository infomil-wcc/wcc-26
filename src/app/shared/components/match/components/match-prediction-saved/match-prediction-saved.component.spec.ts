import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchPredictionSavedComponent } from './match-prediction-saved.component';
import { By } from '@angular/platform-browser';

describe('MatchPredictionSavedComponent', () => {
  let component: MatchPredictionSavedComponent;
  let fixture: ComponentFixture<MatchPredictionSavedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchPredictionSavedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchPredictionSavedComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply bg-success-box if outcome is correct', () => {
    component.match = { fulltime_a: 1, fulltime_b: 0 };
    component.isOutcomeCorrectVal = true;
    fixture.detectChanges();
    
    const wrapper = fixture.debugElement.query(By.css('.pronostiqueDone')).nativeElement;
    expect(wrapper.classList).toContain('bg-success-box');
  });

  it('should apply bg-danger-box if outcome is incorrect', () => {
    component.match = { fulltime_a: 1, fulltime_b: 0 };
    component.isOutcomeCorrectVal = false;
    fixture.detectChanges();
    
    const wrapper = fixture.debugElement.query(By.css('.pronostiqueDone')).nativeElement;
    expect(wrapper.classList).toContain('bg-danger-box');
  });

  it('should emit onClearScorer when clear scorer button is clicked', () => {
    spyOn(component.onClearScorer, 'emit');
    component.closed = false;
    component.hidePointsBadge = false;
    component.isSavedInApi = false;
    component.donePronostique = { scorer: 'Mbappe' };
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('.clear-scorer-btn')).nativeElement;
    btn.click();
    expect(component.onClearScorer.emit).toHaveBeenCalled();
  });

  it('should display "Modifier mon pronostic" if conditions are met', () => {
    spyOn(component.onModifierPronostic, 'emit');
    component.isSavedInApi = true;
    component.donePronostique = { id: 1 };
    component.match = { phase: 'Round of 16', fulltime_a: null, fulltime_b: null };
    component.isEditing = false;
    component.hidePointsBadge = false;
    component.countdownText = '2 jours';
    component.isMatchFinishedByDate = false;
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('.btnEditpronostic')).nativeElement;
    expect(btn.textContent).toContain('Modifier mon pronostic');
    btn.click();
    expect(component.onModifierPronostic.emit).toHaveBeenCalled();
  });
});
