import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

export default async function handler(request, response) {
  console.log(`[INFO] Catch-up script initiated via ${request.method} request.`);
  
  if (handleCors(request, response)) return;

  if (request.method !== 'POST' && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!adminToken || !apiKey) {
    return response.status(500).json({ error: "Missing required environment variables." });
  }

  try {
    // 1. Fetch matches from football-data
    const fdEndpoint = 'https://api.football-data.org/v4/competitions/WC/matches';
    console.log(`[API CALL] Fetching external matches from: ${fdEndpoint}`);
    const fdRes = await fetch(fdEndpoint, { headers: { 'X-Auth-Token': apiKey } });
    if (!fdRes.ok) throw new Error(`Football-Data API failed: ${fdRes.status}`);
    
    const fdData = await fdRes.json();
    const finishedMatches = (fdData.matches || []).filter(m => m.status === 'FINISHED');

    // 2. Fetch matches from Directus
    const dbEndpoint = `${directusUrl}/items/matches?limit=-1`;
    console.log(`[DB CALL] Fetching database records from: ${dbEndpoint}`);
    const dbRes = await fetch(dbEndpoint, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!dbRes.ok) throw new Error(`Directus failed to fetch matches: ${dbRes.status}`);
    
    const dbData = await dbRes.json();
    const dbMatches = dbData.data || [];
    dbMatches.sort((a, b) => parseInt(a.id) - parseInt(b.id));

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

      // If we made it here, this match needs work!
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
      break; // Stop looking! We found our single target for this execution.
    }

    // Case: Everything is already completely up to date
    if (!matchToUpdate) {
      console.log("[COMPLETE] All matches are completely synced. Nothing to update.");
      return response.status(200).json({ success: true, message: "All matches up to date. No updates needed." });
    }

    // 4. Update the single match found (NO SLEEP TIME DELAY NEEDED!)
    console.log(`\n[PROCESSING] Syncing Single Match ID ${matchToUpdate.id}: ${matchToUpdate.team_a} vs ${matchToUpdate.team_b}`);
    
    let scorers = '';
    const detailUrl = `https://api.football-data.org/v4/matches/${correspondingExtMatch.id}`;
    console.log(`[API CALL] Requesting match detail from: ${detailUrl}`);
    
    const detailRes = await fetch(detailUrl, { headers: { 'X-Auth-Token': apiKey } });
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      const scorersList = (detailData.goals || []).map(g => g.scorer?.name).filter(Boolean);
      scorers = scorersList.length > 0 ? scorersList.join(', ') : '';
      console.log(`[DATA] Retrieved Scorers: "${scorers}"`);
    } else {
      console.error(`[ERROR] Failed fetching scorers. Status: ${detailRes.status}`);
    }

    targetPayload.scorers = scorers;

    // 5. Patch Directus
    const patchUrl = `${directusUrl}/items/matches/${matchToUpdate.id}`;
    console.log(`[DB PATCH] URL: ${patchUrl}`);
    console.log(`[DB PAYLOAD] Data to patch:`, JSON.stringify(targetPayload, null, 2));

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(targetPayload)
    });

    console.log(`[DB RESPONSE] Match ID ${matchToUpdate.id} Patch Success Status: ${patchRes.ok}`);

    return response.status(200).json({
      success: true,
      message: `Successfully synced Match ID ${matchToUpdate.id}.`,
      updated: { id: matchToUpdate.id, teams: `${matchToUpdate.team_a} vs ${matchToUpdate.team_b}`, success: patchRes.ok }
    });

  } catch (error) {
    console.error("[CRITICAL ERROR] Execution failed:", error);
    return response.status(500).json({ error: error.message });
  }
}