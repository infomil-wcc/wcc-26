import { handleCors, fetchWithBypass } from '../backend/libs/utils.mjs';
import { getDbMatchUtcTime, autoAdvanceKnockoutStages } from './match-results.mjs';
import { syncMatchesPipeline } from '../backend/libs/match-core.mjs';
import { recalculateRankings } from '../backend/libs/calc-rankings.mjs';
import { Receiver, Client } from "@upstash/qstash";

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

    const signature = request.headers['upstash-signature'];
    let isQStashValid = false;

    // Verify QStash request
    if (signature && env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
      try {
        const receiver = new Receiver({
          currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
          nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
        });
        
        // Vercel parses JSON body; stringify it for Upstash verification
        const bodyStr = request.body && Object.keys(request.body).length > 0 ? JSON.stringify(request.body) : "";
        const isValid = await receiver.verify({ signature, body: bodyStr });
        if (isValid) isQStashValid = true;
      } catch (err) {
        console.error("QStash verification failed:", err.message);
      }
      
      if (!isQStashValid && env.NODE_ENV === 'production') {
         return response.status(401).json({ error: 'Unauthorized: QStash Signature mismatch' });
      }
    } else {
      // Fallback for Vercel Cron
      if (env.CRON_SECRET && request.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
        if (env.NODE_ENV === 'production') {
          return response.status(401).json({ error: 'Unauthorized: Cron Secret Mismatch' });
        }
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
      let allDbMatches = [];

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
        allDbMatches = dbData.data || [];
        const nowMs = Date.now();

        for (const m of allDbMatches) {
          const matchUtcTime = _getDbMatchUtcTime(m.date);
          if (matchUtcTime && matchUtcTime <= nowMs) {
            if (m.current_status !== 'finished' || !m.status_updated || new Date(m.status_updated).getTime() < matchUtcTime) {
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

      // ----------------------------------------------------
      // DYNAMICALLY SCHEDULE NEXT MATCH CHECK WITH QSTASH
      // ----------------------------------------------------
      if (env.QSTASH_TOKEN && allDbMatches.length > 0) {
        const nowMs = Date.now();
        // Find the next match that hasn't started yet
        const futureMatches = allDbMatches.filter(m => {
          const matchTime = _getDbMatchUtcTime(m.date);
          return matchTime && matchTime > nowMs;
        });

        if (futureMatches.length > 0) {
          // Sort to find the very next one
          futureMatches.sort((a, b) => _getDbMatchUtcTime(a.date) - _getDbMatchUtcTime(b.date));
          const nextMatch = futureMatches[0];
          const nextMatchTime = _getDbMatchUtcTime(nextMatch.date);
          
          const qstashClient = new Client({ token: env.QSTASH_TOKEN });
          
          // Determine the public URL to callback
          const baseUrl = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : `https://${request.headers.host}`;
          const targetUrl = `${baseUrl}/api/match-scheduler`;
          
          try {
            await qstashClient.publishJSON({
              url: targetUrl,
              body: { trigger: "auto-schedule", matchId: nextMatch.id },
              // Schedule exactly when the match starts (or add delay if preferred)
              notBefore: Math.floor(nextMatchTime / 1000)
            });
            console.log(`Scheduled next QStash trigger for match ${nextMatch.id} at ${new Date(nextMatchTime).toISOString()}`);
          } catch (qErr) {
            console.error("Failed to schedule next match via QStash:", qErr.message);
          }
        }
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