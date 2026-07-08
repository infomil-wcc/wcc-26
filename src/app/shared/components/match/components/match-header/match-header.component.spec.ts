import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchHeaderComponent } from './match-header.component';
import { By } from '@angular/platform-browser';

describe('MatchHeaderComponent', () => {
  let component: MatchHeaderComponent;
  let fixture: ComponentFixture<MatchHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchHeaderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MatchHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the group phase if match.group exists', () => {
    component.match = { group: 'Group A', id: '1', date: '2026-06-11T16:00:00Z' };
    fixture.detectChanges();
    const phaseSpan = fixture.debugElement.query(By.css('.phase')).nativeElement;
    expect(phaseSpan.textContent).toContain('Group A - M1');
  });

  it('should display the knockout phase if match.group does not exist', () => {
    component.match = { phase: 'Round of 16', id: '50', date: '2026-06-26T16:00:00Z' };
    fixture.detectChanges();
    const phaseSpan = fixture.debugElement.query(By.css('.phase')).nativeElement;
    expect(phaseSpan.textContent).toContain('Round of 16 - M50');
  });

  it('should format the date correctly', () => {
    component.match = { group: 'Group A', id: '1', date: '2026-06-11T16:00:00Z' };
    fixture.detectChanges();
    const dateDiv = fixture.debugElement.query(By.css('.date-time')).nativeElement;
    expect(dateDiv.textContent).toContain('11'); // Simple check to see if date pipe ran
  });

  it('should show LOCKED badge when isSavedInApi is true', () => {
    component.match = {};
    component.isSavedInApi = true;
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.badge')).nativeElement;
    expect(badge.textContent).toContain('LOCKED');
    expect(badge.classList).toContain('locked');
  });

  it('should show Prédit badge when pronostiqueDone is true and isSavedInApi is false', () => {
    component.match = {};
    component.pronostiqueDone = true;
    component.isSavedInApi = false;
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.badge')).nativeElement;
    expect(badge.textContent).toContain('Prédit');
    expect(badge.classList).toContain('predicted');
  });

  it('should show Clos badge when closed is true and pronostiqueDone is false', () => {
    component.match = {};
    component.closed = true;
    component.pronostiqueDone = false;
    component.isSavedInApi = false;
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.badge')).nativeElement;
    expect(badge.textContent).toContain('Clos');
    expect(badge.classList).toContain('closed');
  });

  it('should show Scheduled badge when closed is false, pronostiqueDone false, and isSavedInApi false', () => {
    component.match = {};
    component.closed = false;
    component.pronostiqueDone = false;
    component.isSavedInApi = false;
    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.badge')).nativeElement;
    expect(badge.textContent).toContain('Scheduled');
    expect(badge.classList).toContain('scheduled');
  });

  it('should display the stadium if provided', () => {
    component.match = { stadium: 'Azteca' };
    fixture.detectChanges();
    const venueDiv = fixture.debugElement.query(By.css('.venue')).nativeElement;
    expect(venueDiv.textContent).toContain('Azteca');
  });

  it('should display the countdown text if provided', () => {
    component.match = {};
    component.countdownText = '2 jours restants';
    fixture.detectChanges();
    const countdownDiv = fixture.debugElement.query(By.css('.countdown-timer')).nativeElement;
    expect(countdownDiv.textContent).toContain('2 jours restants');
    expect(countdownDiv.classList).toContain('active-countdown');
  });

  it('should not apply active-countdown class if countdownText is Match commencé', () => {
    component.match = {};
    component.countdownText = 'Match commencé';
    fixture.detectChanges();
    const countdownDiv = fixture.debugElement.query(By.css('.countdown-timer')).nativeElement;
    expect(countdownDiv.classList).not.toContain('active-countdown');
  });
});
