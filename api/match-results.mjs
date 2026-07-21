import { handleCors, fetchWithBypass } from '../backend/libs/utils.mjs';
import { syncMatchesPipeline } from '../backend/libs/match-core.mjs';
import { recalculateRankings } from '../backend/libs/calc-rankings.mjs';
import { autoAdvanceKnockoutStages } from '../backend/libs/knockoutAutoAdvanceHelper.mjs';
export { autoAdvanceKnockoutStages };
export { hasMatchChanged } from '../backend/libs/match-calculations.mjs';

// Proxy internal exports to maintain external backwards compatibility
export { getNormalizedTeamName, getNormalizedPhase, getDbMatchUtcTime, getFdMatchUtcTime, getWcGameApproxUtcTime, parseScorersString } from '../backend/libs/match-mappings.mjs';

// ==========================================
// FACTORY FUNCTION FOR ROUTE HANDLER (DI)
// ==========================================
export function createHandler(deps = {}) {
  // Injectable dependencies with standard production fallbacks
  const fetch = deps.fetch || fetchWithBypass;
  const env = deps.env || process.env;
  const _syncMatchesPipeline = deps.syncMatchesPipeline || syncMatchesPipeline;
  const _autoAdvanceKnockoutStages = deps.autoAdvanceKnockoutStages || autoAdvanceKnockoutStages;
  const _recalculateRankings = deps.recalculateRankings || recalculateRankings;

  return async function handler(request, response) {
    if (handleCors(request, response)) return;

    if (request.method !== 'POST' && request.method !== 'GET') {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const directusUrl = env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = env.DIRECTUS_ADMIN_TOKEN;
    const apiKey = env.FOOTBALL_DATA_API_KEY;

    const queryData = request.query || {};
    const matchesParam = queryData.matches ? queryData.matches.replace(/['"]/g, '').trim() : null;
    const pointsParam = queryData.points ? queryData.points.replace(/['"]/g, '').trim() : null;

    const shouldSyncAndCalcAll = (matchesParam === 'all' && pointsParam === 'all');
    const shouldCalcAll = (pointsParam === 'all' && matchesParam !== 'all');
    const shouldSyncMatches = matchesParam !== null && !shouldSyncAndCalcAll;
    const syncMatchId = (matchesParam && matchesParam !== 'all') ? parseInt(matchesParam, 10) : null;
    const forceUpdate = queryData.force === 'true';

    const isExplicitOverride = matchesParam !== null || pointsParam !== null;

    const headersData = request.headers || {};
    const authHeader = headersData.authorization || '';
    let loggedInUser = headersData['x-user-id'] || headersData['x-authenticated-user'] || null;

    if (!isExplicitOverride && !loggedInUser && !authHeader) {
      return response.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No user session detected and no override parameter passed."
      });
    }

    if (!apiKey) {
      return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
    }

    let syncResults = [];
    let calculationLogs = [];
    let knockoutUpdates = [];
    let matchingResults = [];

    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };

      if (shouldSyncAndCalcAll || shouldSyncMatches) {
        const dbUrl = syncMatchId ? `${directusUrl}/items/matches/${syncMatchId}` : `${directusUrl}/items/matches?limit=-1`;
        const dbRes = await fetch(dbUrl, { headers });

        let dbMatches = [];
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          dbMatches = Array.isArray(dbData.data) ? dbData.data : [dbData.data].filter(Boolean);
        } else {
          throw new Error(`Directus matches lookup failed: ${dbRes.statusText}`);
        }

        // Forward injected fetch context downward
        const pipeline = await _syncMatchesPipeline(dbMatches, { directusUrl, adminToken, apiKey }, { fetch });
        syncResults = pipeline.updates;
        matchingResults = pipeline.apiLogs;

        try {
          knockoutUpdates = await _autoAdvanceKnockoutStages(directusUrl, adminToken, { fetch });
        } catch (advanceErr) {
          console.error("Failed to advance knockout matches automatically:", advanceErr.message);
        }

        const offset = queryData.offset !== undefined ? parseInt(queryData.offset, 10) : 0;
        const batchSize = queryData.batchSize !== undefined ? parseInt(queryData.batchSize, 10) : null;

        let targetUser = (pointsParam && pointsParam !== 'all') ? pointsParam : null;
        if (shouldSyncAndCalcAll) {
          calculationLogs = await _recalculateRankings(directusUrl, adminToken, null, loggedInUser, true, { fetch }, offset, batchSize, forceUpdate);
        } else if (targetUser || shouldCalcAll) {
          calculationLogs = await _recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, true, { fetch }, offset, batchSize, forceUpdate);
        }
      } else {
        const offset = queryData.offset !== undefined ? parseInt(queryData.offset, 10) : 0;
        const batchSize = queryData.batchSize !== undefined ? parseInt(queryData.batchSize, 10) : null;
        let targetUser = (pointsParam && pointsParam !== 'all') ? pointsParam : null;
        calculationLogs = await _recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride, { fetch }, offset, batchSize, forceUpdate);
      }
    } catch (error) {
      return response.status(500).json({ error: error.message });
    }

    let finalMsg = 'Recalculation processed successfully.';
    if (shouldSyncAndCalcAll) {
      finalMsg = 'All matches synced and recalculation complete.';
    } else if (shouldSyncMatches) {
      finalMsg = 'Matches synchronization processed successfully.';
    }

    return response.status(200).json({
      success: true,
      message: finalMsg,
      updates: syncResults,
      knockoutUpdates,
      calculationLogs,
      matchingResults
    });
  };
}

// Initialize a default instance for production runtime and export it
const defaultHandler = createHandler();
export default defaultHandler;

