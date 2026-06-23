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
  const apiFootballKey = process.env.API_FOOTBALL_KEY;

  if (!adminToken) {
    log("[ERROR] Missing required environment variable DIRECTUS_ADMIN_TOKEN.");
    return response.status(500).json({ error: "Missing DIRECTUS_ADMIN_TOKEN environment variable.", logs: executionLogs });
  }

  if (!apiFootballKey) {
    log("[ERROR] Missing required environment variable API_FOOTBALL_KEY.");
    return response.status(500).json({ error: "Missing API_FOOTBALL_KEY environment variable.", logs: executionLogs });
  }

  try {
    // 1. Fetch matches from api-football.com (League ID 1 = World Cup, Season 2026)
    const afEndpoint = 'https://v3.football.api-sports.io/fixtures?league=1&season=2026';
    log(`[API CALL] Fetching external matches list from: ${afEndpoint}`);
    
    const afRes = await fetch(afEndpoint, {
      headers: {
        'x-apisports-key': apiFootballKey
      }
    });
    
    if (!afRes.ok) throw new Error(`API-Football failed with status: ${afRes.status}`);
    
    const afData = await afRes.json();
    const externalFixtures = afData.response || [];
    const finishedStatus = ['FT', 'AET', 'PEN'];
    const finishedFixtures = externalFixtures.filter(f => finishedStatus.includes(f.fixture?.status?.short));
    log(`[INFO] Retrieved ${finishedFixtures.length} finished fixtures from API-Football.`);

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

    // 3. Find matches that need updates
    const matchesToUpdate = [];

    for (const dbMatch of dbMatches) {
      const extMatch = finishedFixtures.find(f => {
        const home = getNormalizedTeamName(f.teams?.home?.name);
        const away = getNormalizedTeamName(f.teams?.away?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!extMatch) continue;

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(extMatch.teams?.away?.name));
      
      const homeScore = extMatch.goals?.home;
      const awayScore = extMatch.goals?.away;
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      const htHome = extMatch.score?.halftime?.home;
      const htAway = extMatch.score?.halftime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htAway) : Number(htHome)) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htHome) : Number(htAway)) : null;

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

      matchesToUpdate.push({
        dbMatch,
        extFixtureId: extMatch.fixture?.id,
        dbScoreA,
        dbScoreB,
        winnerDraw,
        targetHtA,
        targetHtB
      });
    }

    if (matchesToUpdate.length === 0) {
      log("[COMPLETE] Verified all scanned items. Zero updates required.");
      return response.status(200).json({ 
        success: true, 
        message: "No entries needed syncing.", 
        apiCallsMade: 1,
        updatesProcessed: 0, 
        logs: executionLogs 
      });
    }

    // 4. Batch query detailed events for fixtures needing update (optimized to max 10 to save api calls)
    const batch = matchesToUpdate.slice(0, 10);
    log(`[INFO] Found ${matchesToUpdate.length} matches needing updates. Fetching details for batch of ${batch.length} matches.`);

    const idsStr = batch.map(item => item.extFixtureId).join('-');
    const detailedEndpoint = `https://v3.football.api-sports.io/fixtures?ids=${idsStr}`;
    log(`[API CALL] Fetching detailed event data from: ${detailedEndpoint}`);
    
    const detailedRes = await fetch(detailedEndpoint, {
      headers: {
        'x-apisports-key': apiFootballKey
      }
    });

    if (!detailedRes.ok) throw new Error(`API-Football detailed query failed with status: ${detailedRes.status}`);
    
    const detailedData = await detailedRes.json();
    const detailedFixtures = detailedData.response || [];

    const itemsToPatch = [];

    for (const item of batch) {
      const detailedFixture = detailedFixtures.find(f => f.fixture?.id === item.extFixtureId);
      
      let scorers = '[]';
      if (detailedFixture) {
        const goalEvents = (detailedFixture.events || [])
          .filter(e => e.type === 'Goal')
          .map(e => ({
            time: {
              elapsed: e.time?.elapsed,
              extra: e.time?.extra || null
            },
            team: {
              name: e.team?.name
            },
            player: {
              name: e.player?.name
            },
            detail: e.detail
          }));
        scorers = JSON.stringify(goalEvents);
      }

      itemsToPatch.push({
        id: item.dbMatch.id,
        fulltime_a: item.dbScoreA, 
        fulltime_b: item.dbScoreB, 
        winner_draw: item.winnerDraw,
        halftime_a: item.targetHtA, 
        halftime_b: item.targetHtB,
        fulltime: true,
        halftime: (item.targetHtA !== null && item.targetHtB !== null),
        scorers: scorers
      });

      log(`[STAGING] Staged Match ID ${item.dbMatch.id} (${item.dbMatch.team_a} vs ${item.dbMatch.team_b}) with scorers JSON: ${scorers}`);
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