import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(request, response) {
  console.log(`[INFO] Catch-up script initiated via ${request.method} request.`);
  
  if (handleCors(request, response)) return;

  if (request.method !== 'POST' && request.method !== 'GET') {
    console.warn(`[WARN] Method ${request.method} not allowed.`);
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let directusUrl = process.env.DIRECTUS_URL;
  if (!directusUrl || directusUrl === 'undefined') {
    directusUrl = 'https://euro.omediainteractive.net/imleuro';
  }
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!adminToken) {
    console.error("[ERROR] Missing DIRECTUS_ADMIN_TOKEN env variable.");
    return response.status(500).json({ error: "Missing DIRECTUS_ADMIN_TOKEN environment variable." });
  }
  if (!apiKey) {
    console.error("[ERROR] Missing FOOTBALL_DATA_API_KEY env variable.");
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  try {
    // 1. Fetch matches from football-data
    const fdEndpoint = 'https://api.football-data.org/v4/competitions/WC/matches';
    console.log(`[API CALL 1] Fetching external matches from: ${fdEndpoint}`);
    const fdRes = await fetch(fdEndpoint, {
      headers: { 'X-Auth-Token': apiKey }
    });
    if (!fdRes.ok) {
      throw new Error(`Football-Data API failed: ${fdRes.status}`);
    }
    const fdData = await fdRes.json();
    const externalMatches = fdData.matches || [];
    console.log(`[INFO] Successfully retrieved ${externalMatches.length} matches from Football-Data.`);

    // 2. Fetch matches from Directus
    const dbEndpoint = `${directusUrl}/items/matches?limit=-1`;
    console.log(`[DB CALL] Fetching database records from: ${dbEndpoint}`);
    const dbRes = await fetch(dbEndpoint, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!dbRes.ok) {
      throw new Error(`Directus failed to fetch matches: ${dbRes.status}`);
    }
    const dbData = await dbRes.json();
    const dbMatches = dbData.data || [];
    console.log(`[INFO] Successfully retrieved ${dbMatches.length} matches from Directus.`);

    const finishedMatches = externalMatches.filter(m => m.status === 'FINISHED');
    dbMatches.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    const results = [];
    let apiCallsCount = 1; // 1 call already made for external matches list

    for (const dbMatch of dbMatches) {
      if (apiCallsCount >= 9) {
        console.log("[LIMIT REACHED] Reached threshold of 9 API calls per execution to protect Vercel timeouts. Halting execution loop.");
        break;
      }

      const extMatch = finishedMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!extMatch) continue;

      console.log(`\n[PROCESSING] Evaluating Match ID ${dbMatch.id}: ${dbMatch.team_a} vs ${dbMatch.team_b}`);

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(extMatch.awayTeam?.name));
      const homeScore = extMatch.score?.fullTime?.home;
      const awayScore = extMatch.score?.fullTime?.away;
      
      const dbScoreA = isReversed ? awayScore : homeScore;
      const dbScoreB = isReversed ? homeScore : awayScore;

      // Extract external half-time scores safely
      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htAway : htHome) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? htHome : htAway) : null;

      // OPTIMIZATION: Early skip if halftime data, fulltime scores, AND scorers are already populated[cite: 3]
      const hasScorersPopulated = dbMatch.scorers && dbMatch.scorers !== 'null' && dbMatch.scorers.trim() !== '';
      
      if (
        dbMatch.fulltime_a === dbScoreA && 
        dbMatch.fulltime_b === dbScoreB && 
        dbMatch.halftime_a === targetHtA && 
        dbMatch.halftime_b === targetHtB && 
        hasScorersPopulated
      ) {
        console.log(`[SKIP] Match ID ${dbMatch.id} is fully synchronized. Fulltime (${dbMatch.fulltime_a}-${dbMatch.fulltime_b}), Halftime (${dbMatch.halftime_a}-${dbMatch.halftime_b}), and Scorers are already populated. Moving to next record.`);
        continue;
      }

      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) {
        winnerDraw = dbMatch.team_a;
      } else if (dbScoreB > dbScoreA) {
        winnerDraw = dbMatch.team_b;
      }

      // Base validation check for changes[cite: 3]
      const needsUpdate = 
        dbMatch.fulltime_a !== dbScoreA ||
        dbMatch.fulltime_b !== dbScoreB ||
        dbMatch.winner_draw !== winnerDraw ||
        dbMatch.halftime_a !== targetHtA ||
        dbMatch.halftime_b !== targetHtB ||
        !hasScorersPopulated;

      if (!needsUpdate) {
        console.log(`[INFO] Match ID ${dbMatch.id} does not require updates based on verification logic.`);
        continue;
      }

      // Rate Limit Execution Delay[cite: 3]
      const delayMs = 6800;
      console.log(`[WAIT] Sleeping for ${delayMs / 1000}s to avoid rate limiting before pulling match item details...`);
      await delay(delayMs);

      let scorers = '';
      const detailUrl = `https://api.football-data.org/v4/matches/${extMatch.id}`;
      console.log(`[API CALL ${apiCallsCount + 1}] Requesting match detail from: ${detailUrl}`);
      
      try {
        const detailRes = await fetch(detailUrl, {
          headers: { 'X-Auth-Token': apiKey }
        });
        apiCallsCount++;

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          // Map goal events to extracting text strings containing player names safely
          const scorersList = (detailData.goals || [])
            .map(g => g.scorer?.name)
            .filter(Boolean);
          scorers = scorersList.length > 0 ? scorersList.join(', ') : '';
          console.log(`[DATA] Retrieved Scorers for Match ID ${dbMatch.id}: "${scorers}"`);
        } else {
          console.error(`[ERROR] Failed fetching subresource data details. Status: ${detailRes.status}`);
        }
      } catch (err) {
        console.error(`[EXCEPT] Scorers parsing failure on Match ${dbMatch.id}:`, err.message);
      }

      const payload = {
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winnerDraw,
        scorers: scorers
      };

      if (targetHtA !== null && targetHtB !== null) {
        payload.halftime_a = targetHtA;
        payload.halftime_b = targetHtB;
      }

      // Explicit logs revealing the incoming Directus network state mutations
      const patchUrl = `${directusUrl}/items/matches/${dbMatch.id}`;
      console.log(`[DB PATCH] Sending updates to Directus for Match ID ${dbMatch.id}. URL: ${patchUrl}`);
      console.log(`[DB PAYLOAD] Data to patch:`, JSON.stringify(payload, null, 2));

      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      console.log(`[DB RESPONSE] Match ID ${dbMatch.id} Patch Success Status: ${patchRes.ok}`);

      results.push({
        id: dbMatch.id,
        teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
        success: patchRes.ok
      });
    }

    console.log(`[COMPLETE] Run complete. Total API calls executed: ${apiCallsCount}`);
    return response.status(200).json({
      success: true,
      message: `Completed sync step. Updated ${results.length} matches.`,
      apiCallsMade: apiCallsCount,
      updates: results
    });

  } catch (error) {
    console.error("[CRITICAL ERROR] Execution failed unexpected:", error);
    return response.status(500).json({ error: error.message });
  }
}