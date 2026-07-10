import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamInfoModalComponent } from './team-info-modal.component';
import { By } from '@angular/platform-browser';

describe('TeamInfoModalComponent', () => {
  let component: TeamInfoModalComponent;
  let fixture: ComponentFixture<TeamInfoModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamInfoModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamInfoModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display spinner when loadingTeamInfo is true', () => {
    component.loadingTeamInfo = true;
    fixture.detectChanges();
    const spinner = fixture.debugElement.query(By.css('.spin'));
    expect(spinner).toBeTruthy();
  });

  it('should display empty state if past matches is empty', () => {
    component.loadingTeamInfo = false;
    component.teamPastMatches = [];
    fixture.detectChanges();
    const emptyMsg = fixture.debugElement.query(By.css('.text-center.p-4')).nativeElement;
    expect(emptyMsg.textContent).toContain('Aucun match passé');
  });

  it('should display a list of matches', () => {
    component.loadingTeamInfo = false;
    component.teamPastMatches = [
      { id: 1, phase: 'Group Stage', date: '2026-06-11', team_a: 'France', team_b: 'Brazil', fulltime_a: 2, fulltime_b: 0 }
    ];
    fixture.detectChanges();
    
    const list = fixture.debugElement.queryAll(By.css('.past-match-card'));
    expect(list.length).toBe(1);
    expect(list[0].nativeElement.textContent).toContain('France');
    expect(list[0].nativeElement.textContent).toContain('Brazil');
    expect(list[0].nativeElement.textContent).toContain('2 - 0');
  });

  it('should emit onCloseModal when close button is clicked', () => {
    spyOn(component.onCloseModal, 'emit');
    fixture.detectChanges();
    const closeBtn = fixture.debugElement.query(By.css('.modal-close-btn')).nativeElement;
    closeBtn.click();
    expect(component.onCloseModal.emit).toHaveBeenCalled();
  });
});
