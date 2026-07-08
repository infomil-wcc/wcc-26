import { TestBed } from '@angular/core/testing';

import { MatchCountdownService } from './match-countdown.service';

describe('MatchCountdownService', () => {
  let service: MatchCountdownService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MatchCountdownService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
