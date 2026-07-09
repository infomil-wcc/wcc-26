import { TestBed } from '@angular/core/testing';
import { PointsCalculatorService } from './points-calculator.service';
import { Matches } from '../../../shared/contracts/matches.contract';
import { Pronostiques } from '../../../shared/contracts/pronostiques.contract';

describe('PointsCalculatorService', () => {
  let service: PointsCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PointsCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isPredictionFraud', () => {
    let mockMatch: Matches;
    let mockPrediction: Pronostiques;

    beforeEach(() => {
      mockMatch = {
        id: '1',
        date: '2026-06-11 16:00:00', // Match at 16:00 Mauritian time (12:00 UTC)
      } as Matches;

      mockPrediction = {
        id: '1',
        created_on: '2026-06-11T10:00:00Z', // Created at 10:00 UTC (14:00 Mauritian)
        modified_on: null,
      } as unknown as Pronostiques;
    });

    it('should return false for valid prediction before kickoff', () => {
      // 10:00 UTC < 12:00 UTC
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeFalse();
    });

    it('should return true if prediction created exactly at kickoff', () => {
      // 12:00 UTC == 16:00 Mauritian time
      mockPrediction.created_on = '2026-06-11T12:00:00Z';
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeTrue();
    });

    it('should return true if prediction created after kickoff', () => {
      // 12:01 UTC > 12:00 UTC
      mockPrediction.created_on = '2026-06-11T12:01:00Z';
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeTrue();
    });

    it('should evaluate modified_on instead of created_on if modified_on is present', () => {
      // Created at 10:00 UTC (valid), but modified at 13:00 UTC (invalid)
      mockPrediction.created_on = '2026-06-11T10:00:00Z';
      mockPrediction.modified_on = '2026-06-11T13:00:00Z';
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeTrue();
    });

    it('should return false if modified_on is present but before kickoff', () => {
      // Created at 09:00 UTC, modified at 11:59 UTC (valid)
      mockPrediction.created_on = '2026-06-11T09:00:00Z';
      mockPrediction.modified_on = '2026-06-11T11:59:00Z';
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeFalse();
    });

    it('should return false if prediction is missing', () => {
      expect(service.isPredictionFraud(mockMatch, null as any)).toBeFalse();
    });

    it('should return false if match.date is missing', () => {
      mockMatch.date = '';
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeFalse();
    });

    it('should return false if prediction dates are missing', () => {
      mockPrediction.created_on = undefined as any;
      mockPrediction.modified_on = undefined as any;
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeFalse();
    });

    it('should handle match date with explicit timezone correctly', () => {
      // If match date already has timezone (+04:00), the logic should not append it again
      mockMatch.date = '2026-06-11T16:00:00+04:00';
      mockPrediction.created_on = '2026-06-11T13:00:00Z'; // 13:00 UTC (after kickoff)
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeTrue();

      mockPrediction.created_on = '2026-06-11T11:00:00Z'; // 11:00 UTC (before kickoff)
      expect(service.isPredictionFraud(mockMatch, mockPrediction)).toBeFalse();
    });
  });
});
