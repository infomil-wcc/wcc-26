import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamDetailsComponent } from './team-details.component';
import { HyphernatePipe } from '../../../../shared/pipe/hyphernate.pipe';
import { TeamTabsComponent } from '../team-tabs/team-tabs.component';

describe('TeamDetailsComponent', () => {
  let component: TeamDetailsComponent;
  let fixture: ComponentFixture<TeamDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamDetailsComponent, HyphernatePipe, TeamTabsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TeamDetailsComponent);
    component = fixture.componentInstance;
    component.team = { name: 'Test Team', iso: 'TST' } as any;
    component.teamMatches = [];
    component.teamDetails = [];
    component.today = { dateTime: '2026-06-15T12:00:00Z' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
