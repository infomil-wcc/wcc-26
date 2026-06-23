import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

export default async function handler(request, response) {
  const executionLogs = [];
  
  const log = (message, data = null) => {
    const formatted = data ? `${message} ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}` : message;
    executionLogs.push(formatted);
    console.log(formatted);
  };

  log(`[INFO] Batch catch-up script initiated via ${request.method} request.`);
  
  if (handleCors(request, response)) return;

  if (request.method !== 'POST' && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed', logs: executionLogs });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!adminToken || !apiKey) {
    log("[ERROR] Missing required environment variables (DIRECTUS_ADMIN_TOKEN or FOOTBALL_DATA_API_KEY).");
    return response.status(500).json({ error: "Missing required environment variables.", logs: executionLogs });
  }

  try {
    // 1. Fetch matches from football-data
    const fdEndpoint = 'https://api.football-data.org/v4/competitions/WC/matches';
    log(`[API CALL] Fetching external matches list from: ${fdEndpoint}`);
    const fdRes = await fetch(fdEndpoint, { headers: { 'X-Auth-Token': apiKey } });
    if (!fdRes.ok) throw new Error(`Football-Data API failed with status: ${fdRes.status}`);
    
    const fdData = await fdRes.json();
    const finishedMatches = (fdData.matches || []).filter(m => m.status === 'FINISHED');
    log(`[INFO] Retrieved ${finishedMatches.length} finished matches from Football-Data.`);

    // 2. Fetch matches from Directus
    const dbEndpoint = `${directusUrl}/items/matches?limit=-1`;
    log(`[DB CALL] Fetching database records from: ${dbEndpoint}`);
    const dbRes = await fetch(dbEndpoint, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!dbRes.ok) throw new Error(`Directus failed to fetch matches with status: ${dbRes.status}`);
    
    const dbData = await dbRes.json();
    const dbMatches = dbData.data || [];
    log(`[INFO] Retrieved ${dbMatches.length} matches from Directus.`);

    // 3. Collect up to 8 matches that actually need verification/updates in this cron cycle
    const itemsToPatch = [];
    let apiCallsCount = 1;

    for (const dbMatch of dbMatches) {
      if (apiCallsCount >= 9) {
        log("[NOTICE] Subresource details threshold limit (8 detailed matches) reached. Packing collected payloads into single request.");
        break;
      }

      const extMatch = finishedMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!extMatch) continue;

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(extMatch.awayTeam?.name));
      const homeScore = extMatch.score?.fullTime?.home;
      const awayScore = extMatch.score?.fullTime?.away;
      const dbScoreA = isReversed ? awayScore : homeScore;
      const dbScoreB = isReversed ? homeScore : awayScore;

      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htAway : htHome) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htHome : htAway) : null;

      const hasScorersPopulated = dbMatch.scorers && dbMatch.scorers !== 'null' && dbMatch.scorers.trim() !== '' && dbMatch.scorers.trim() !== '[]';

      // Verify if fully identical, skip if so
      if (
        dbMatch.fulltime_a === dbScoreA && 
        dbMatch.fulltime_b === dbScoreB && 
        dbMatch.halftime_a === targetHtA && 
        dbMatch.halftime_b === targetHtB && 
        hasScorersPopulated
      ) {
        continue;
      }

      // Found a candidate requiring updates
      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) winnerDraw = dbMatch.team_a;
      else if (dbScoreB > dbScoreA) winnerDraw = dbMatch.team_b;

      log(`[STAGING] Resolving details for Match ID ${dbMatch.id} (${dbMatch.team_a} vs ${dbMatch.team_b})...`);

      // Fetch specific scorers details concurrently/sequentially (No delay needed, execution will finish cleanly)
      let rawGoalsDataString = '[]';
      const detailUrl = `https://api.football-data.org/v4/matches/${extMatch.id}`;
      
      try {
        const detailRes = await fetch(detailUrl, { 
          headers: { 'X-Auth-Token': apiKey, 'X-Unfold-Goals': 'true' } 
        });
        apiCallsCount++;

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const goalsArray = detailData.goals || [];
          rawGoalsDataString = JSON.stringify(goalsArray);
          log(` -> Match ${dbMatch.id}: Staged ${goalsArray.length} goal events.`);
        } else {
          log(` -> [ERROR] Subresource details status code: ${detailRes.status}`);
        }
      } catch (err) {
        log(` -> [EXCEPT] Failed fetching detail metrics: ${err.message}`);
      }

      // Build target object containing fields + identifier key
      itemsToPatch.push({
        id: dbMatch.id, // Primary Key
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winnerDraw,
        halftime_a: targetHtA,
        halftime_b: targetHtB,
        scorers: rawGoalsDataString
      });
    }

    if (itemsToPatch.length === 0) {
      log("[COMPLETE] Everything completely verified. Zero updates needed.");
      return response.status(200).json({ success: true, message: "All items perfectly synced.", updatesProcessed: 0, logs: executionLogs });
    }

    // 4. Fire Single Batch Patch request to Directus
    const collectionUrl = `${directusUrl}/items/matches`;
    log(`\n[DB BATCH PATCH] Issuing single call to: ${collectionUrl}`);
    log(`[DB BATCH PAYLOAD] Array contents structured for payload:`, itemsToPatch);

    const batchRes = await fetch(collectionUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(itemsToPatch) // Directus accepts a root level array of objects for multi-updates
    });

    log(`[DB RESPONSE] Single Batch patch execution success state: ${batchRes.ok}`);
    
    if(!batchRes.ok) {
      const errorText = await batchRes.text();
      log(`[DB ERROR DETAILS] Directus payload rejection: ${errorText}`);
    }

    return response.status(200).json({
      success: batchRes.ok,
      message: `Completed processing execution step. Handled batch updates for ${itemsToPatch.length} matching rows inside single query.`,
      apiCallsMade: apiCallsCount,
      updatesProcessed: itemsToPatch.length,
      logs: executionLogs
    });

  } catch (error) {
    log(`[CRITICAL ERROR] Pipeline execution stopped unexpected: ${error.message}`);
    return response.status(500).json({ error: error.message, logs: executionLogs });
  }
}