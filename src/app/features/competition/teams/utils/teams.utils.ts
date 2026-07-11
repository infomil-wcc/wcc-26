import { Teams } from '../../../../shared/contracts/teams.contract';
import { Country } from '../components/country-details/country-details.component';

export function sortTeamsByName(teams: Teams[]): Teams[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name));
}

export function addShowDetailsProperty(teams: Teams[]): (Teams & { showDetails: boolean })[] {
  return teams.map(t => ({ ...t, showDetails: false }));
}

export function sortCountryTimeline(countries: Country[]): Country[] {
  if (!countries || !Array.isArray(countries)) return [];
  return countries.map(country => {
    if (country.timeline) {
      country.timeline.sort((a: any, b: any) => b.year - a.year);
    }
    return country;
  });
}
