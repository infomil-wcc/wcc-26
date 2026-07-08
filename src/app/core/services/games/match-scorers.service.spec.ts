import { TestBed } from '@angular/core/testing';

import { MatchScorersService } from './match-scorers.service';

describe('MatchScorersService', () => {
  let service: MatchScorersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MatchScorersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
