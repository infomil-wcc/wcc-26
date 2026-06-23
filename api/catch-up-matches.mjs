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

  // Extract starting ID from query string parameter (defaults to 0 if not provided)
  const startIdParam = request.query?.startId;
  const startId = startIdParam ? parseInt(startIdParam, 10) : 0;

  log(`[INFO] Batch catch-up script initiated via ${request.method} request. Starting at Directus ID: ${startId}`);
  
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
    let dbMatches = dbData.data || [];
    
    // Sort items numerically by ID
    dbMatches.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    // Filter using query string parameters: Only process matches greater than or equal to startId
    if (startId > 0) {
      const totalBefore = dbMatches.length;
      dbMatches = dbMatches.filter(match => parseInt(match.id, 10) >= startId);
      log(`[FILTER] Query string applied. Filtered out ${totalBefore - dbMatches.length} matches where ID < ${startId}.`);
    }
    log(`[INFO] Evaluating ${dbMatches.length} matching rows from Directus.`);

    // 3. Process matches (Strict limit: Cap external detail requests at 7, total API calls will not exceed 8)
    const itemsToPatch = [];
    let apiCallsCount = 1; // 1 call already used for the initial matches list

    for (const dbMatch of dbMatches) {
      // Hard stop threshold: 8 total calls (1 list call + 7 detail calls) to strictly respect the limit
      if (apiCallsCount >= 8) {
        log(`[NOTICE] Total Football-Data API calls reached standard threshold limit of ${apiCallsCount}. Stopping loop to stay clear of limits.`);
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

      // Check if scorers field is already valid JSON data
      let hasScorersPopulated = false;
      try {
        if (dbMatch.scorers && dbMatch.scorers !== 'null' && dbMatch.scorers.trim() !== '') {
          const parsed = JSON.parse(dbMatch.scorers);
          if (Array.isArray(parsed) && parsed.length >= 0) {
            hasScorersPopulated = true;
          }
        }
      } catch (e) {
        // Not valid JSON string format, needs update logic below
        hasScorersPopulated = false;
      }

      // Verify if record is fully synchronized
      if (
        dbMatch.fulltime_a === dbScoreA && 
        dbMatch.fulltime_b === dbScoreB && 
        dbMatch.halftime_a === targetHtA && 
        dbMatch.halftime_b === targetHtB && 
        hasScorersPopulated
      ) {
        continue;
      }

      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) winnerDraw = dbMatch.team_a;
      else if (dbScoreB > dbScoreA) winnerDraw = dbMatch.team_b;

      log(`[STAGING] Resolving details for Match ID ${dbMatch.id} (${dbMatch.team_a} vs ${dbMatch.team_b})...`);

      let rawGoalsDataString = '[]';
      const detailUrl = `https://api.football-data.org/v4/matches/${extMatch.id}`;
      
      try {
        log(`[API CALL ${apiCallsCount + 1}] Querying match details endpoint: ${detailUrl}`);
        const detailRes = await fetch(detailUrl, { 
          headers: { 'X-Auth-Token': apiKey, 'X-Unfold-Goals': 'true' } 
        });
        apiCallsCount++;

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const goalsArray = detailData.goals || [];
          
          // Confirms full goal details stay preserved inside a structured JSON configuration string
          rawGoalsDataString = JSON.stringify(goalsArray);
          log(` -> Match ${dbMatch.id}: Staged full raw JSON description containing ${goalsArray.length} goal nodes.`);
        } else {
          log(` -> [ERROR] Subresource detail retrieval failed. Status code: ${detailRes.status}`);
          continue; // Skip staging this match if endpoint fails
        }
      } catch (err) {
        log(` -> [EXCEPT] Error fetching details: ${err.message}`);
        continue;
      }

      itemsToPatch.push({
        id: dbMatch.id,
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winnerDraw,
        halftime_a: targetHtA,
        halftime_b: targetHtB,
        scorers: rawGoalsDataString // Stored directly as valid raw JSON string format data
      });
    }

    if (itemsToPatch.length === 0) {
      log("[COMPLETE] Verified all scanned items. Zero updates required.");
      return response.status(200).json({ 
        success: true, 
        message: "No entries needed syncing.", 
        apiCallsMade: apiCallsCount,
        updatesProcessed: 0, 
        logs: executionLogs 
      });
    }

    // 4. Batch Patch Directus inside one combined query
    const collectionUrl = `${directusUrl}/items/matches`;
    log(`\n[DB BATCH PATCH] Issuing single call to: ${collectionUrl}`);
    log(`[DB BATCH PAYLOAD] Array contents structured for payload:`, itemsToPatch);

    const batchRes = await fetch(collectionUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(itemsToPatch) // Directus handles mass payload mappings through unified arrays
    });

    log(`[DB RESPONSE] Single Batch patch execution success state: ${batchRes.ok}`);
    
    if (!batchRes.ok) {
      const errorText = await batchRes.text();
      log(`[DB ERROR DETAILS] Directus payload rejection: ${errorText}`);
    }

    return response.status(200).json({
      success: batchRes.ok,
      message: `Completed processing step starting from ID ${startId}. Handled updates for ${itemsToPatch.length} rows inside a single query.`,
      apiCallsMade: apiCallsCount,
      updatesProcessed: itemsToPatch.length,
      logs: executionLogs
    });

  } catch (error) {
    log(`[CRITICAL ERROR] Pipeline execution stopped unexpected: ${error.message}`);
    return response.status(500).json({ error: error.message, logs: executionLogs });
  }
}