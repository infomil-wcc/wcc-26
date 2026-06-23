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

  // Extract starting ID from query string parameter
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
    // 1. Fetch matches from football-data (This provides EVERYTHING we need, including goal metadata)
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

    // Filter using query string parameters
    if (startId > 0) {
      const totalBefore = dbMatches.length;
      dbMatches = dbMatches.filter(match => parseInt(match.id, 10) >= startId);
      log(`[FILTER] Filtered out ${totalBefore - dbMatches.length} matches where ID < ${startId}.`);
    }
    log(`[INFO] Evaluating ${dbMatches.length} matching rows from Directus.`);

    // 3. Process matches in memory without loops making downstream API requests
    const itemsToPatch = [];

    for (const dbMatch of dbMatches) {
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
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htAway) : Number(htHome)) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htHome) : Number(htAway)) : null;

      // Extract the goals array straight out of the parent object map
      const goalsPayload = extMatch.goals || [];

      // Check if scorers field is already populated with data matching our structured criteria
      let hasScorersPopulated = false;
      if (dbMatch.scorers) {
        if (Array.isArray(dbMatch.scorers) && dbMatch.scorers.length > 0) {
          hasScorersPopulated = true;
        } else if (typeof dbMatch.scorers === 'string' && dbMatch.scorers.trim() !== '' && dbMatch.scorers !== 'null' && dbMatch.scorers !== '[]') {
          hasScorersPopulated = true;
        }
      }

      // Verify if record is fully identical and synchronized
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

      log(`[STAGING] Match ID ${dbMatch.id} (${dbMatch.team_a} vs ${dbMatch.team_b}): Staged ${goalsPayload.length} goal nodes extracted from root list.`);

      itemsToPatch.push({
        id: dbMatch.id,
        fulltime_a: dbScoreA, 
        fulltime_b: dbScoreB, 
        winner_draw: winnerDraw,
        halftime_a: targetHtA, 
        halftime_b: targetHtB, 
        scorers: goalsPayload // Extracted cleanly without any secondary network dependencies!
      });
    }

    if (itemsToPatch.length === 0) {
      log("[COMPLETE] Verified all scanned items. Zero updates required.");
      return response.status(200).json({ 
        success: true, 
        message: "No entries needed syncing.", 
        apiCallsMade: 1,
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
      body: JSON.stringify(itemsToPatch)
    });

    log(`[DB RESPONSE] Single Batch patch execution success state: ${batchRes.ok}`);
    
    if (!batchRes.ok) {
      const errorText = await batchRes.text();
      log(`[DB ERROR DETAILS] Directus payload rejection: ${errorText}`);
    }

    return response.status(200).json({
      success: batchRes.ok,
      message: `Completed processing step starting from ID ${startId}. Handled updates for ${itemsToPatch.length} rows inside a single query.`,
      apiCallsMade: 1,
      updatesProcessed: itemsToPatch.length,
      logs: executionLogs
    });

  } catch (error) {
    log(`[CRITICAL ERROR] Pipeline execution stopped unexpected: ${error.message}`);
    return response.status(500).json({ error: error.message, logs: executionLogs });
  }
}