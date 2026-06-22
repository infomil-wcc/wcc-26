import { handleCors } from './utils.mjs';

// --- TEAM NAME MAPPING DICTIONARY ---
// Add any mismatched external names here: "External Name": "Your DB Name"
const teamNameMap = {
  "South Korea": "Korea Republic",
  "Czech Republic": "Czechia",
  "United States": "USA",
  "Curaçao": "Curacao",
  "Turkey": "Türkiye",
  "Cape Verde": "Cabo Verde",
  "Democratic Republic of the Congo": "DR Congo",
  // "External Name From API": "Exact Name In Your Directus DB"
};

// --- TOURNAMENT PHASE MAPPING DICTIONARY ---
// Maps the API "type" to Directus DB "phase" value
const phaseMap = {
  "group": "Group Stage",
  "r32": "Round of 32",
  "r16": "Round of 16",
  "qf": "Quarter-finals",
  "sf": "Semi-finals",
  "third": "Third Place",
  "final": "Final"
};

/**
 * Helper function to clean and map team names
 */
function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();

  // FALLBACK: Returns the mapped name if found, 
  // otherwise defaults to the original name exactly as retrieved.
  return teamNameMap[trimmedName] || trimmedName;
}

/**
 * Helper function to cleanly map API stage type to DB Phase name
 * Treats keys completely case-insensitively (e.g., "R32" or "r32" -> "Round of 32")
 */
function getNormalizedPhase(apiType) {
  if (!apiType) return null;
  const lowerType = apiType.toLowerCase().trim();
  return phaseMap[lowerType] || lowerType;
}

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // =========================================================================
  // TESTING MODE CONFIGURATION FLAG
  // True = Logs updates to console (Dry Run). False = Patches real DB data.
  // =========================================================================
  const DRY_RUN = true;

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let games = [];

  // Isolated check for the external network dependency
  try {
    const wcRes = await fetch('https://worldcup26.ir/get/games', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        // Bypasses automated bot blockers by presenting a standard browser signature
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!wcRes.ok) {
      throw new Error(`External API responded with HTTP status ${wcRes.status}`);
    }

    const data = await wcRes.json();
    games = data.games || [];

  } catch (networkError) {
    console.error("Network Error: Unable to reach worldcup26.ir ->", networkError.message);

    // Graceful exit instead of a full system 500 crash
    return response.status(503).json({
      success: false,
      error: "External World Cup API is currently unreachable or offline.",
      details: networkError.message
    });
  }

  // Fetch and evaluate database matches
  try {

    // ALWAYS make the real Directus call to see what your database returns
    const myMatchesRes = await fetch(`${process.env.DIRECTUS_URL}/items/matches?filter[fulltime][_eq]=false&fields=id,team_a,team_b,match_date,phase`, {
      headers: { 'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` }
    });

    if (!myMatchesRes.ok) throw new Error(`Directus bulk lookup failed with status ${myMatchesRes.status}`);
    const directusData = await myMatchesRes.json();
    const internalMatches = directusData.data || [];

    // =========================================================================
    // 🔍 DRY RUN / LOG REAL API DATA RESULT
    // =========================================================================
    if (DRY_RUN) {
      console.log(`\n=========================================================================`);
      console.log(`🗄️ [DRY RUN] LIVE API RESPONSE RECEIVED (${internalMatches.length} pending matches found)`);
      console.log(`Inspecting raw items currently returned by API:`);
      console.log(JSON.stringify(internalMatches, null, 2));
      console.log(`=========================================================================\n`);
    }

    const results = [];

    for (const game of games) {

      // Only process and PATCH if the match is completed
      if (game.finished !== "TRUE" && game.time_elapsed !== "finished") {
        continue; // Skip directly to the next game in the loop
      }
      const homeScore = parseInt(game.home_score, 10);
      const awayScore = parseInt(game.away_score, 10);

      // Normalize names (maps if present, otherwise leaves them as retrieved)
      const dbHomeName = getNormalizedTeamName(game.home_team_name_en);
      const dbAwayName = getNormalizedTeamName(game.away_team_name_en);

      let winnerDraw = "Draw";
      if (homeScore > awayScore) winnerDraw = dbHomeName;
      else if (awayScore > homeScore) winnerDraw = dbAwayName;

      const payload = {
        fulltime_a: homeScore,
        fulltime_b: awayScore,
        winner_draw: winnerDraw,
        fulltime: true
      };

      const [datePart] = game.local_date.split(' ');
      const [month, day, year] = datePart.split('/');
      const externalMatchDate = `${year}-${month}-${day}`;
      const targetDbPhase = getNormalizedPhase(game.type);

      // Verify records with compound keys against API data
      const matchedRecord = internalMatches.find(m => {
        const internalMatchDate = new Date(m.match_date).toISOString().split('T')[0];
        
        return m.team_a === dbHomeName && 
               m.team_b === dbAwayName && 
               internalMatchDate === externalMatchDate &&
               m.phase === targetDbPhase;
      });

      if (!matchedRecord) {
        results.push({
          teams: `${dbHomeName} vs ${dbAwayName}`,
          status: "Skipped",
          reason: `No pending entry found matching criteria for phase "${targetDbPhase}" on ${externalMatchDate}.`
        });
        continue;
      }

      let operationOk = false;

      // =========================================================================
      // 🔀 DRY RUN / PATCH PREVIEW LOGS
      // =========================================================================
      if (DRY_RUN) {
        console.log(`\n-------------------------------------------------------------------------`);
        console.log(`🔍 [MATCH INTEGRITY LOOKUP MATCHED SUCCESSFULLY]`);
        console.log(`   Incoming Raw Entry ID:     ${game.id}`);
        console.log(`   REAL API Row ID:      ${matchedRecord.id}`);
        console.log(`   Fixture Names Verified:    [team_a: ${dbHomeName}] vs [team_b: ${dbAwayName}]`);
        console.log(`   Chronology & Phase:        Date: ${externalMatchDate} | Phase: ${targetDbPhase}`);
        console.log(`   📦 PROPOSED DB PATCH PAYLOAD:`);
        console.log(JSON.stringify(payload, null, 2));
        console.log(`-------------------------------------------------------------------------`);
        operationOk = true; 
      } else {
        const directusResponse = await fetch(`${process.env.DIRECTUS_URL}/items/matches/${matchedRecord.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
          },
          body: JSON.stringify(payload)
        });
        operationOk = directusResponse.ok;
      }

     results.push({
        id: matchedRecord.id,
        teams: `${dbHomeName} vs ${dbAwayName}`,
        status: DRY_RUN ? "Tested (Console Preview)" : "Updated Live",
        success: operationOk
      });
    }

    return response.status(200).json({
      success: true,
      dry_run_active: DRY_RUN,
      message: `Synchronisation effectuée. ${results.length} matchs terminés mis à jour.`,
      updates: results
    });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}