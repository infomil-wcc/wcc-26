import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

export default async function handler(request, response) {
  // Array to collect all log statements during this execution
  const executionLogs = [];
  
  const log = (message, data = null) => {
    const formatted = data ? `${message} ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}` : message;
    executionLogs.push(formatted);
    console.log(formatted); // Keep native logging active for Vercel Log dashboard
  };

  log(`[INFO] Catch-up script initiated via ${request.method} request.`);
  
  if (handleCors(request, response)) return;

  if (request.method !== 'POST' && request.method !== 'GET') {
    log(`[WARN] Method ${request.method} not allowed.`);
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
    log(`[API CALL] Fetching external matches from: ${fdEndpoint}`);
    const fdRes = await fetch(fdEndpoint, { headers: { 'X-Auth-Token': apiKey } });
    if (!fdRes.ok) {
      throw new Error(`Football-Data API failed with status: ${fdRes.status}`);
    }
    
    const fdData = await fdRes.json();
    const finishedMatches = (fdData.matches || []).filter(m => m.status === 'FINISHED');
    log(`[INFO] Retrieved ${finishedMatches.length} finished matches from Football-Data.`);

    // 2. Fetch matches from Directus
    const dbEndpoint = `${directusUrl}/items/matches?limit=-1`;
    log(`[DB CALL] Fetching database records from: ${dbEndpoint}`);
    const dbRes = await fetch(dbEndpoint, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!dbRes.ok) {
      throw new Error(`Directus failed to fetch matches with status: ${dbRes.status}`);
    }
    
    const dbData = await dbRes.json();
    const dbMatches = dbData.data || [];
    dbMatches.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    log(`[INFO] Retrieved ${dbMatches.length} matches from Directus.`);

    // 3. Find the FIRST match that actually needs an update
    let matchToUpdate = null;
    let correspondingExtMatch = null;
    let targetPayload = null;

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
      const dbScoreA = isReversed ? awayScore : homeScore;
      const dbScoreB = isReversed ? homeScore : awayScore;

      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htAway : htHome) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htHome : htAway) : null;

      const hasScorersPopulated = dbMatch.scorers && dbMatch.scorers !== 'null' && dbMatch.scorers.trim() !== '';

      // Skip fully synced matches
      if (
        dbMatch.fulltime_a === dbScoreA && 
        dbMatch.fulltime_b === dbScoreB && 
        dbMatch.halftime_a === targetHtA && 
        dbMatch.halftime_b === targetHtB && 
        hasScorersPopulated
      ) {
        continue;
      }

      // Found a match requiring work
      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) winnerDraw = dbMatch.team_a;
      else if (dbScoreB > dbScoreA) winnerDraw = dbMatch.team_b;

      matchToUpdate = dbMatch;
      correspondingExtMatch = extMatch;
      targetPayload = {
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winnerDraw,
        halftime_a: targetHtA,
        halftime_b: targetHtB
      };
      break; 
    }

    // Case: Everything up to date
    if (!matchToUpdate) {
      log("[COMPLETE] All matches are fully synchronized. Nothing to update.");
      return response.status(200).json({ 
        success: true, 
        message: "All matches up to date. No updates needed.",
        logs: executionLogs
      });
    }

    // 4. Update the single match found
    log(`[PROCESSING] Syncing Match ID ${matchToUpdate.id}: ${matchToUpdate.team_a} vs ${matchToUpdate.team_b}`);
    
    let rawGoalsDataString = '';
    const detailUrl = `https://api.football-data.org/v4/matches/${correspondingExtMatch.id}`;
    log(`[API CALL] Requesting match details from: ${detailUrl} with X-Unfold-Goals configuration`);
    
    const detailRes = await fetch(detailUrl, { 
      headers: { 
        'X-Auth-Token': apiKey,
        'X-Unfold-Goals': 'true' // Added unfolding custom header configuration parameter here
      } 
    });
    
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      const goalsArray = detailData.goals || [];
      
      if (goalsArray.length > 0) {
        log(`[SUCCESS] Captured ${goalsArray.length} goal events from the API. Storing data into the scorers field.`);
        rawGoalsDataString = JSON.stringify(goalsArray);
      } else {
        log(`[NOTICE] Goals array data captured successfully but it returned empty (0 goals / 0-0 match).`);
        rawGoalsDataString = '[]';
      }
    } else {
      log(`[ERROR] Failed fetching match goals details. Status code: ${detailRes.status}`);
    }

    targetPayload.scorers = rawGoalsDataString;

    // 5. Patch Directus
    const patchUrl = `${directusUrl}/items/matches/${matchToUpdate.id}`;
    log(`[DB PATCH] Patch URL: ${patchUrl}`);
    log(`[DB PAYLOAD] Data to patch:`, targetPayload);

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(targetPayload)
    });

    log(`[DB RESPONSE] Match ID ${matchToUpdate.id} Patch Success Status: ${patchRes.ok}`);

    return response.status(200).json({
      success: true,
      message: `Successfully synced Match ID ${matchToUpdate.id}.`,
      updated: { 
        id: matchToUpdate.id, 
        teams: `${matchToUpdate.team_a} vs ${matchToUpdate.team_b}`, 
        success: patchRes.ok 
      },
      logs: executionLogs
    });

  } catch (error) {
    log(`[CRITICAL ERROR] Execution failed: ${error.message}`);
    return response.status(500).json({ 
      error: error.message, 
      logs: executionLogs 
    });
  }
}