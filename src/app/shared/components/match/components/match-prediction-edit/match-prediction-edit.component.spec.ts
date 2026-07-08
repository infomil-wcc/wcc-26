import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchPredictionEditComponent } from './match-prediction-edit.component';
import { By } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('MatchPredictionEditComponent', () => {
  let component: MatchPredictionEditComponent;
  let fixture: ComponentFixture<MatchPredictionEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchPredictionEditComponent],
      providers: [DatePipe, provideHttpClient(), provideRouter([])]
    })
    .overrideComponent(MatchPredictionEditComponent, {
      remove: { imports: [] } 
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchPredictionEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display VS for draw when phase is Group Stage', () => {
    component.match = { phase: 'Group Stage' };
    component.closed = false;
    fixture.detectChanges();
    const drawBox = fixture.debugElement.query(By.css('.draw-vs-box span')).nativeElement;
    expect(drawBox.textContent).toContain('VS');
  });

  it('should display PENALTY for draw when phase is Knockout and matchOutcome is Draw', () => {
    component.match = { phase: 'Round of 16' };
    component.matchOutcome = 'Draw';
    component.closed = false;
    fixture.detectChanges();
    const penaltyBox = fixture.debugElement.query(By.css('.teamName strong')).nativeElement;
    expect(penaltyBox.textContent).toContain('PENALTY');
  });

  it('should emit onSelectWinner when team button is clicked', () => {
    spyOn(component.onSelectWinner, 'emit');
    component.match = { team_a: 'France', team_b: 'Brazil' };
    component.canEditPrediction = true;
    component.closed = false;
    fixture.detectChanges();

    const teamAButton = fixture.debugElement.query(By.css('.teamA')).nativeElement;
    teamAButton.click();
    expect(component.onSelectWinner.emit).toHaveBeenCalledWith('France');

    const drawButton = fixture.debugElement.query(By.css('.draw')).nativeElement;
    drawButton.click();
    expect(component.onSelectWinner.emit).toHaveBeenCalledWith('Draw');
  });

  it('should display Invalidé badge when hidePointsBadge is true', () => {
    component.hidePointsBadge = true;
    component.invalidatedDate = new Date('2026-06-11T12:00:00Z');
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('.invalid-title')).nativeElement;
    expect(badge.textContent).toContain('Invalidé');
  });

  it('should emit onSelectPenaltyWinner when penalty radio is selected', () => {
    spyOn(component.onSelectPenaltyWinner, 'emit');
    component.match = { id: '1', team_a: 'France', phase: 'Round of 16', fulltime: true };
    component.matchOutcome = 'Draw';
    component.closed = false;
    component.canEditScores = true;
    fixture.detectChanges();

    const radio = fixture.debugElement.query(By.css('input[type="radio"]')).nativeElement;
    radio.dispatchEvent(new Event('change'));
    expect(component.onSelectPenaltyWinner.emit).toHaveBeenCalledWith('France');
  });

  it('should trigger onOpenTacticalLineup when "Choisir un buteur" is clicked', () => {
    spyOn(component.onOpenTacticalLineup, 'emit');
    component.match = { scorer: true, fulltime: true };
    component.canSelectScorer = true;
    component.closed = false;
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('.btn-select-scorer')).nativeElement;
    btn.click();
    expect(component.onOpenTacticalLineup.emit).toHaveBeenCalled();
  });
});
