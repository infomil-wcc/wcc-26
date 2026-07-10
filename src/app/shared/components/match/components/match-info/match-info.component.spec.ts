import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchInfoComponent } from './match-info.component';
import { By } from '@angular/platform-browser';
import { Component, Input } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

// Mock the child component
@Component({
  selector: 'teamperformance',
  standalone: true,
  template: '<div>Mock Team Performance</div>'
})
class MockTeamPerformanceComponent {
  @Input() teamName!: string;
}

describe('MatchInfoComponent', () => {
  let component: MatchInfoComponent;
  let fixture: ComponentFixture<MatchInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchInfoComponent],
      providers: [provideHttpClient(), provideRouter([])]
    })
    .overrideComponent(MatchInfoComponent, {
      remove: { imports: [] }, // Wait, standalone components imports are a bit tricky to mock this way in new Angular.
      // A better way is to override the template or just mock the component if we can.
      // But since it's standalone, we might need to use NO_ERRORS_SCHEMA or keep the real one if it's lightweight.
      // We'll keep the real one if we can't easily mock. Or we can just let it render.
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchInfoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit onShowTeamDetails when INFO button is clicked', () => {
    spyOn(component.onShowTeamDetails, 'emit');
    component.match = { team_a: 'France', team_b: 'Brazil' };
    fixture.detectChanges();
    
    const infoButtons = fixture.debugElement.queryAll(By.css('.info-btn-bottom'));
    expect(infoButtons.length).toBe(2);
    
    // Click Team A's info button
    infoButtons[0].triggerEventHandler('click', new Event('click'));
    expect(component.onShowTeamDetails.emit).toHaveBeenCalledWith(jasmine.objectContaining({ team: 'France' }));

    // Click Team B's info button
    infoButtons[1].triggerEventHandler('click', new Event('click'));
    expect(component.onShowTeamDetails.emit).toHaveBeenCalledWith(jasmine.objectContaining({ team: 'Brazil' }));
  });

  it('should display team names and flags', () => {
    component.match = { team_a: 'France', team_b: 'Brazil' };
    component.teamAFlag = 'path/to/france.png';
    component.teamBFlag = 'path/to/brazil.png';
    fixture.detectChanges();

    const teamNames = fixture.debugElement.queryAll(By.css('.teamName'));
    expect(teamNames[0].nativeElement.textContent).toContain('France');
    expect(teamNames[1].nativeElement.textContent).toContain('Brazil');

    const flags = fixture.debugElement.queryAll(By.css('.flagContainer'));
    expect(flags[0].nativeElement.style.backgroundImage).toContain('path/to/france.png');
    expect(flags[1].nativeElement.style.backgroundImage).toContain('path/to/brazil.png');
  });

  it('should fallback to unknown flag if team is null', () => {
    component.match = { team_a: null, team_b: null };
    fixture.detectChanges();

    const flags = fixture.debugElement.queryAll(By.css('.flagContainer'));
    expect(flags[0].nativeElement.style.backgroundImage).toContain('unknown.png');
    expect(flags[1].nativeElement.style.backgroundImage).toContain('unknown.png');
  });
});
