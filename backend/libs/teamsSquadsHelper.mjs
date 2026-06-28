import { readJsonFile, applyFiltersAndSelect } from './utils.mjs';

/**
 * Handles the retrieval and filtering logic for teams and squads data.
 * @param {string} type - The data category type ('teams' or 'squads').
 * @param {Object} queryParams - Filtering and selection criteria extracted from the request query.
 * @returns {Promise<{status: number, data: any}>} Evaluated HTTP response payload status and data payload.
 */
export async function getTeamsOrSquads(type, queryParams) {
    if (type === 'squads') {
        const data = await readJsonFile('squads-data.json');
        const allSquadsData = data.squads || [];

        const result = applyFiltersAndSelect(allSquadsData, queryParams, 'country');
        return { status: result.status, data: result.data };
    }

    if (type === 'teams') {
        const allTeamsData = await readJsonFile('teams-data.json');
        const { status, data } = applyFiltersAndSelect(allTeamsData, queryParams, 'name');

        // Handle structural fallback if clean parameters but matching errors occur
        if (status === 404 && data?.error === 'No elements match the provided filters.') {
            const { select, ...filters } = queryParams;
            if (Object.keys(filters).length === 0 && !select) {
                return { status: 200, data: allTeamsData };
            }
        }

        return { status, data };
    }

    // Return status 400 structure if an invalid or missing type arrives
    return {
        status: 400,
        data: { error: "Paramètre 'type' manquant ou invalide. Veuillez utiliser ?type=teams ou ?type=squads" }
    };
}