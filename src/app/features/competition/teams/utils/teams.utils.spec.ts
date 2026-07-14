import { sortTeamsByName, addShowDetailsProperty, sortCountryTimeline } from './teams.utils';
import { Teams } from '../../../../shared/contracts/teams.contract';
import { Country } from '@shared/contracts/country.contract';

describe('Teams Utils', () => {
  describe('sortTeamsByName', () => {
    it('should sort teams alphabetically by name', () => {
      const teams = [
        { name: 'Zambia', iso: 'ZM', flag_url: '' },
        { name: 'Argentina', iso: 'AR', flag_url: '' },
        { name: 'France', iso: 'FR', flag_url: '' }
      ] as Teams[];
      
      const sorted = sortTeamsByName(teams);
      expect(sorted[0].name).toBe('Argentina');
      expect(sorted[1].name).toBe('France');
      expect(sorted[2].name).toBe('Zambia');
    });
  });

  describe('addShowDetailsProperty', () => {
    it('should add showDetails property set to false', () => {
      const teams = [{ name: 'Argentina' }] as Teams[];
      const mapped = addShowDetailsProperty(teams);
      expect(mapped[0].showDetails).toBeFalse();
      expect(mapped[0].name).toBe('Argentina');
    });
  });

  describe('sortCountryTimeline', () => {
    it('should sort timeline by year in descending order', () => {
      const countries = [
        {
          name: 'France',
          timeline: [
            { year: 1998, text: { en: 'Won' } },
            { year: 2018, text: { en: 'Won' } },
            { year: 2006, text: { en: 'Final' } }
          ]
        }
      ] as Country[];

      const sorted = sortCountryTimeline(countries);
      expect(sorted[0].timeline[0].year).toBe(2018);
      expect(sorted[0].timeline[1].year).toBe(2006);
      expect(sorted[0].timeline[2].year).toBe(1998);
    });

    it('should handle undefined or non-array inputs gracefully', () => {
      expect(sortCountryTimeline(null as any)).toEqual([]);
      expect(sortCountryTimeline(undefined as any)).toEqual([]);
    });
  });
});
