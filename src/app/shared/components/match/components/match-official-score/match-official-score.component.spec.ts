import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchOfficialScoreComponent } from './match-official-score.component';
import { By } from '@angular/platform-browser';

describe('MatchOfficialScoreComponent', () => {
  let component: MatchOfficialScoreComponent;
  let fixture: ComponentFixture<MatchOfficialScoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchOfficialScoreComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchOfficialScoreComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the final score and halftime score', () => {
    component.match = { fulltime_a: 2, fulltime_b: 1, halftime_a: 1, halftime_b: 0 };
    fixture.detectChanges();
    
    const scorePill = fixture.debugElement.query(By.css('.score-pill')).nativeElement;
    expect(scorePill.textContent).toContain('2');
    expect(scorePill.textContent).toContain('1');

    const htPill = fixture.debugElement.query(By.css('.halftime-score-pill')).nativeElement;
    expect(htPill.textContent).toContain('HT : 1 - 0');
  });

  it('should display penalty score if it exists', () => {
    component.match = { fulltime_a: 1, fulltime_b: 1, penalty_a: 5, penalty_b: 4 };
    fixture.detectChanges();
    
    const scorePill = fixture.debugElement.query(By.css('.score-pill')).nativeElement;
    expect(scorePill.textContent).toContain('(5)');
    expect(scorePill.textContent).toContain('(4)');
  });

  it('should display scorers from JSON if isScorersJson is true', () => {
    component.isScorersJson = true;
    component.teamAScorersGrouped = [{ name: 'Mbappe', times: "12', 45'" }];
    component.teamBScorersGrouped = [];
    fixture.detectChanges();

    const scorersA = fixture.debugElement.query(By.css('.text-left')).nativeElement;
    expect(scorersA.textContent).toContain('Mbappe');
    expect(scorersA.innerHTML).toContain("12', 45'");
  });

  it('should display plain string scorers if isScorersJson is false', () => {
    component.isScorersJson = false;
    component.match = { scorers: 'Mbappe 12\', Giroud 90\'' };
    fixture.detectChanges();

    const scorersA = fixture.debugElement.query(By.css('.text-left')).nativeElement;
    expect(scorersA.textContent).toContain('Mbappe 12\', Giroud 90\'');
  });
});
