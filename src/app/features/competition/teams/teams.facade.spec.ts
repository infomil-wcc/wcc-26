import { TestBed } from '@angular/core/testing';
import { TeamsFacade } from './teams.facade';
import { TeamsService } from '../../../core/services/content/teams.service';
import { MatchesService } from '../../../core/services/content/matches.service';
import { GlobaltimeService } from '../../../core/services/core/global-time.service';
import { signal } from '@angular/core';
import { Teams } from '../../../shared/contracts/teams.contract';
import { Matches } from '../../../shared/contracts/matches.contract';
import { of } from 'rxjs';

describe('TeamsFacade', () => {
  let facade: TeamsFacade;
  
  const mockTeams = [{ name: 'France', iso: 'FR', flag_url: '' }, { name: 'Argentina', iso: 'AR', flag_url: '' }] as Teams[];
  const mockMatches = [{ id: 1, home_team: 'France', away_team: 'Argentina' }] as Matches[];
  
  const mockTeamsService = {
    allTeams: signal(mockTeams),
    getTeamsInfo: jasmine.createSpy('getTeamsInfo').and.returnValue(signal([]))
  };

  const mockMatchesService = {
    getMatchesByTeam: jasmine.createSpy('getMatchesByTeam').and.returnValue(signal(mockMatches))
  };

  const mockGlobaltimeService = {
    getMuTime: jasmine.createSpy('getMuTime').and.returnValue(of({ dateTime: '2026-06-15T12:00:00Z' }))
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TeamsFacade,
        { provide: TeamsService, useValue: mockTeamsService },
        { provide: MatchesService, useValue: mockMatchesService },
        { provide: GlobaltimeService, useValue: mockGlobaltimeService }
      ]
    });
    
    facade = TestBed.inject(TeamsFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should format and sort teamsData properly', () => {
    const teams = facade.teamsData();
    expect(teams.length).toBe(2);
    expect(teams[0].name).toBe('Argentina');
    expect(teams[1].name).toBe('France');
    expect((teams[0] as any).showDetails).toBeFalse();
  });

  it('should allow selecting and clearing a team', () => {
    const team = mockTeams[0];
    facade.selectTeam(team);
    expect(facade.selectedTeam()).toEqual(team);
    
    facade.clearSelection();
    expect(facade.selectedTeam()).toBeNull();
  });

  it('should reactively fetch team matches when team is selected', () => {
    const team = mockTeams[0];
    facade.selectTeam(team);
    
    // Note: Due to the signal computed, we just read the value
    const matches = facade.selectedTeamMatches();
    expect(mockMatchesService.getMatchesByTeam).toHaveBeenCalledWith(team.name, jasmine.any(Object));
    expect(matches).toEqual(mockMatches);
  });
});
