import { TestBed } from '@angular/core/testing';

import { PointsCalculatorService } from './points-calculator.service';

describe('PointsCalculatorService', () => {
  let service: PointsCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PointsCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
