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

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  let games = [];

  // Isolated check for the external network dependency
  try {
    const wcRes = await fetch('https://worldcup26.ir/get/games', {
      method: 'GET',
      headers: {
        'accept': 'application/json'
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

  // Data Processing Strategy
  try {
    const results = [];

    for (const game of games) {

        // Only process and PATCH if the match is completed
        if (game.finished !== "TRUE") {
        continue; // Skip directly to the next game in the loop
      }
      const homeScore = parseInt(game.home_score, 10);
      const awayScore = parseInt(game.away_score, 10);

      // Normalize names (maps if present, otherwise leaves them as retrieved)
      const dbHomeName = getNormalizedTeamName(game.home_team_name_en);
      const dbAwayName = getNormalizedTeamName(game.away_team_name_en);

      let winnerDraw = null;

      if (game.finished === "TRUE") {
        if (homeScore > awayScore) {
          winnerDraw = dbHomeName; 
        } else if (awayScore > homeScore) {
          winnerDraw = dbAwayName; 
        } else {
          winnerDraw = "Draw";
        }
      }

      const payload = {
        fulltime_a: homeScore,
        fulltime_b: awayScore,
        winner_draw: winnerDraw,
        fulltime: true
      };

      
      // Send update payload to Directus match item
      const directusResponse = await fetch(`${process.env.DIRECTUS_URL}/items/matches/${game.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        },
        body: JSON.stringify(payload)
      });
      

      results.push({ 
        id: game.id, 
        teams: `${dbHomeName} vs ${dbAwayName}`,
        status: "Updated",
        success: directusResponse.ok 
      });
    }

    return response.status(200).json({ 
      success: true, 
      message: `Synchronisation effectuée. ${results.length} matchs terminés mis à jour.`, 
      updates: results 
    });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}