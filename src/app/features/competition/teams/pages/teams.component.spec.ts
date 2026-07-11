import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamsComponent } from './teams.component';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { TeamsFacade } from '../teams.facade';
import { signal } from '@angular/core';
import { Teams } from '../../../../shared/contracts/teams.contract';

describe('TeamsComponent', () => {
  let component: TeamsComponent;
  let fixture: ComponentFixture<TeamsComponent>;

  let mockFacade: any;

  beforeEach(async () => {
    mockFacade = {
      teamsData: signal([{ name: 'France', iso: 'FR', flag_url: '' } as Teams]),
      selectedTeam: signal(null),
      selectedTeamMatches: signal([]),
      selectedTeamDetails: signal([]),
      today: signal({ dateTime: '2026-06-15T12:00:00Z' }),
      selectTeam: vi.fn(),
      clearSelection: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TeamsComponent, LoaderComponent],
      providers: [
        { provide: TeamsFacade, useValue: mockFacade }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call facade selectTeam when showTeam is triggered', () => {
    const team = { name: 'France', iso: 'FR', flag_url: '' } as Teams;
    component.showTeam(team);
    expect(mockFacade.selectTeam).toHaveBeenCalledWith(team);
  });


});
