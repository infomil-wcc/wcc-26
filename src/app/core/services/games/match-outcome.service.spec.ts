import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { MatchOutcomeService } from './match-outcome.service';

describe('MatchOutcomeService', () => {
  let service: MatchOutcomeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MatchOutcomeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
