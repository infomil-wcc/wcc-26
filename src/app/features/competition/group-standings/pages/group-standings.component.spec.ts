import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupStandingsComponent } from './group-standings.component';
import { StateService } from '../../../../core/services/core/state.service';
import { TeamsService } from '../../../../core/services/content/teams.service';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';

describe('GroupStandingsComponent', () => {
  let component: GroupStandingsComponent;
  let fixture: ComponentFixture<GroupStandingsComponent>;

  beforeEach(async () => {
    const mockStateService = {
      isMobile: signal(false)
    };

    const mockTeamsService = {
      teams: signal([])
    };

    const mockActivatedRoute = {
      snapshot: { paramMap: { get: () => null } }
    };

    await TestBed.configureTestingModule({
      imports: [GroupStandingsComponent],
      providers: [
        { provide: StateService, useValue: mockStateService },
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupStandingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
