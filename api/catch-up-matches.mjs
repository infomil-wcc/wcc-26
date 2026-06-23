import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

function parseScorersString(scorersStr, teamName) {
  if (!scorersStr || scorersStr === 'null' || scorersStr === '') return [];
  let cleanStr = scorersStr.replace(/[“”]/g, '"');
  
  let arr = [];
  try {
    const parsed = JSON.parse(cleanStr);
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else {
      const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
      if (matches) {
        arr = matches.map(m => m.replace(/^"|"$/g, ''));
      }
    }
  } catch (e) {
    const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    if (matches) {
      arr = matches.map(m => m.replace(/^"|"$/g, ''));
    }
  }

  const events = [];
  for (const goalStr of arr) {
    const regex = /^(.*?)\s+(\d+)(?:\+(\d+))?'\s*(\((?:OG|p|CSC)\))?$/i;
    const match = goalStr.trim().match(regex);
    if (match) {
      const playerName = match[1].trim();
      const elapsed = parseInt(match[2], 10);
      const extra = match[3] ? parseInt(match[3], 10) : null;
      let detail = 'Normal Goal';
      if (match[4]) {
        const detailLower = match[4].toLowerCase();
        if (detailLower.includes('og') || detailLower.includes('csc')) {
          detail = 'Own Goal';
        } else if (detailLower.includes('p')) {
          detail = 'Penalty';
        }
      }
      events.push({
        time: { elapsed, extra },
        team: { name: teamName },
        player: { name: playerName },
        detail
      });
    } else {
      events.push({
        time: { elapsed: 0, extra: null },
        team: { name: teamName },
        player: { name: goalStr.trim() },
        detail: 'Normal Goal'
      });
    }
  }
  return events;
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
  const fdApiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!adminToken) {
    log("[ERROR] Missing required environment variable DIRECTUS_ADMIN_TOKEN.");
    return response.status(500).json({ error: "Missing DIRECTUS_ADMIN_TOKEN environment variable.", logs: executionLogs });
  }

  if (!fdApiKey) {
    log("[ERROR] Missing required environment variable FOOTBALL_DATA_API_KEY.");
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable.", logs: executionLogs });
  }

  try {
    // 1. Fetch matches from football-data.org (for halftime, fulltime scores and finished status)
    const fdEndpoint = 'https://api.football-data.org/v4/competitions/WC/matches';
    log(`[API CALL] Fetching matches list from football-data: ${fdEndpoint}`);
    
    const fdRes = await fetch(fdEndpoint, {
      headers: { 'X-Auth-Token': fdApiKey }
    });
    if (!fdRes.ok) throw new Error(`Football-Data API failed with status: ${fdRes.status}`);
    
    const fdData = await fdRes.json();
    log(`[API RESPONSE] Football-Data matches list response received.`);
    const fdMatches = fdData.matches || [];
    const finishedFdMatches = fdMatches.filter(m => m.status === 'FINISHED');
    log(`[INFO] Retrieved ${finishedFdMatches.length} finished matches from Football-Data.`);

    // 2. Fetch games from worldcup26.ir (for scorer details)
    const wcEndpoint = 'https://worldcup26.ir/get/games';
    log(`[API CALL] Fetching games list from worldcup26.ir: ${wcEndpoint}`);
    const wcRes = await fetch(wcEndpoint);
    if (!wcRes.ok) throw new Error(`worldcup26.ir API failed with status: ${wcRes.status}`);
    
    const wcData = await wcRes.json();
    log(`[API RESPONSE] worldcup26.ir games list response received.`);
    const wcMatches = wcData.games || [];

    // 3. Fetch matches from Directus
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

    // 4. Match and evaluate changes
    const itemsToPatch = [];

    for (const dbMatch of dbMatches) {
      // Find corresponding football-data match
      const fdMatch = finishedFdMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!fdMatch) continue;

      // Find corresponding worldcup26.ir game
      const wcMatch = wcMatches.find(m => {
        if (parseInt(dbMatch.id, 10) === parseInt(m.id, 10)) return true;
        const home = getNormalizedTeamName(m.home_team_name_en);
        const away = getNormalizedTeamName(m.away_team_name_en);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
      
      const homeScore = fdMatch.score?.fullTime?.home;
      const awayScore = fdMatch.score?.fullTime?.away;
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      const htHome = fdMatch.score?.halfTime?.home;
      const htAway = fdMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htAway) : Number(htHome)) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htHome) : Number(htAway)) : null;

      // Parse scorers from worldcup26.ir if found
      let scorers = [];
      if (wcMatch) {
        const homeGoals = parseScorersString(wcMatch.home_scorers, getNormalizedTeamName(wcMatch.home_team_name_en));
        const awayGoals = parseScorersString(wcMatch.away_scorers, getNormalizedTeamName(wcMatch.away_team_name_en));
        const combinedGoals = [...homeGoals, ...awayGoals];
        
        // Sort goals chronologically
        combinedGoals.sort((a, b) => {
          if (a.time.elapsed !== b.time.elapsed) {
            return a.time.elapsed - b.time.elapsed;
          }
          return (a.time.extra || 0) - (b.time.extra || 0);
        });
        
        scorers = combinedGoals;
      }

      // Verify if record is fully identical and synchronized
      let isScorersEmpty = !dbMatch.scorers || dbMatch.scorers === 'null' || dbMatch.scorers === '';
      if (!isScorersEmpty) {
        if (typeof dbMatch.scorers === 'object') {
          if (Array.isArray(dbMatch.scorers)) {
            isScorersEmpty = dbMatch.scorers.length === 0;
          } else {
            isScorersEmpty = Object.keys(dbMatch.scorers).length === 0;
          }
        } else if (typeof dbMatch.scorers === 'string') {
          const trimmed = dbMatch.scorers.trim();
          if (trimmed === '[]' || trimmed === '{}' || trimmed === 'null') {
            isScorersEmpty = true;
          }
        }
      }

      if (
        dbMatch.fulltime_a === dbScoreA && 
        dbMatch.fulltime_b === dbScoreB && 
        dbMatch.halftime_a === targetHtA && 
        dbMatch.halftime_b === targetHtB && 
        !isScorersEmpty
      ) {
        continue;
      }

      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) winnerDraw = dbMatch.team_a;
      else if (dbScoreB > dbScoreA) winnerDraw = dbMatch.team_b;

      itemsToPatch.push({
        id: dbMatch.id,
        fulltime_a: dbScoreA, 
        fulltime_b: dbScoreB, 
        winner_draw: winnerDraw,
        halftime_a: targetHtA, 
        halftime_b: targetHtB,
        fulltime: true,
        halftime: (targetHtA !== null && targetHtB !== null),
        scorers: scorers
      });

      log(`[STAGING] Match ID ${dbMatch.id} (${dbMatch.team_a} vs ${dbMatch.team_b}) scores: ${dbScoreA}-${dbScoreB}, scorers JSON: ${JSON.stringify(scorers)}`);
    }

    if (itemsToPatch.length === 0) {
      log("[COMPLETE] Verified all scanned items. Zero updates required.");
      return response.status(200).json({ 
        success: true, 
        message: "No entries needed syncing.", 
        apiCallsMade: 2,
        updatesProcessed: 0, 
        logs: executionLogs 
      });
    }

    // 5. Batch Patch Directus inside one combined query
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
      apiCallsMade: 2,
      updatesProcessed: itemsToPatch.length,
      logs: executionLogs
    });

  } catch (error) {
    log(`[CRITICAL ERROR] Pipeline execution stopped unexpected: ${error.message}`);
    return response.status(500).json({ error: error.message, logs: executionLogs });
  }
}