import { handleCors, fetchWithBypass } from '../backend/libs/utils.mjs';
import { getDbMatchUtcTime, autoAdvanceKnockoutStages } from './match-results.mjs';
import { syncMatchesPipeline } from '../backend/libs/match-core.mjs';
import { recalculateRankings } from '../backend/libs/calc-rankings.mjs';

// ==========================================
// FACTORY FUNCTION FOR ROUTE HANDLER (DI)
// ==========================================
export function createHandler(deps = {}) {
  const fetch = deps.fetch || fetchWithBypass;
  const env = deps.env || process.env;
  const _getDbMatchUtcTime = deps.getDbMatchUtcTime || getDbMatchUtcTime;
  const _recalculateRankings = deps.recalculateRankings || recalculateRankings;
  const _autoAdvanceKnockoutStages = deps.autoAdvanceKnockoutStages || autoAdvanceKnockoutStages;
  const _syncMatchesPipeline = deps.syncMatchesPipeline || syncMatchesPipeline;

  return async function handler(request, response) {
    if (handleCors(request, response)) return;

    if (env.CRON_SECRET && request.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      if (env.NODE_ENV === 'production') {
        return response.status(401).json({ error: 'Unauthorized: Cron Secret Mismatch' });
      }
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const directusUrl = env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = env.DIRECTUS_ADMIN_TOKEN;
    const apiKey = env.FOOTBALL_DATA_API_KEY;

    const dataInput = { ...request.query, ...request.body };
    const matchId = dataInput.matchId || dataInput.match_id;

    try {
      let dbMatches = [];
      const headers = { 'Authorization': `Bearer ${adminToken}` };

      if (matchId) {
        const dbMatchRes = await fetch(`${directusUrl}/items/matches/${matchId}`, { headers });
        if (dbMatchRes.ok) {
          const matchPayload = await dbMatchRes.json();
          if (matchPayload.data) dbMatches.push(matchPayload.data);
        }
      } else {
        const dbRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
        if (!dbRes.ok) throw new Error(`Directus list lookup failed`);

        const dbData = await dbRes.json();
        const nowMs = Date.now();

        for (const m of (dbData.data || [])) {
          const matchUtcTime = _getDbMatchUtcTime(m.date);
          if (matchUtcTime && matchUtcTime <= nowMs) {
            if (!m.status_updated || new Date(m.status_updated).getTime() < matchUtcTime) {
              dbMatches.push(m);
            }
          }
        }
      }

      // Forward custom fetch wrapper securely down the application logic pipeline
      const { updates, anyMatchJustFinished } = await _syncMatchesPipeline(dbMatches, { directusUrl, adminToken, apiKey }, { fetch });

      let calculationLogs = [];
      let knockoutUpdates = [];

      if (anyMatchJustFinished) {
        try {
          knockoutUpdates = await _autoAdvanceKnockoutStages(directusUrl, adminToken, { fetch });
        } catch (err) {
          console.error("Failed auto-advance cascade:", err.message);
        }
        calculationLogs = await _recalculateRankings(directusUrl, adminToken, null, null, true, { fetch });
      }

      return response.status(200).json({
        success: true,
        message: "Match update processing complete.",
        updates,
        knockoutUpdates,
        calculationLogs
      });

    } catch (error) {
      console.error("Scheduler Failure:", error);
      return response.status(500).json({ error: error.message });
    }
  };
}

// Default instance context configured for standard serverless workflows
export default createHandler();