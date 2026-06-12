import { handleCors } from './utils.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'GET') {
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
      const homeScore = parseInt(game.home_score, 10);
      const awayScore = parseInt(game.away_score, 10);
      let winnerDraw = null;

      if (game.finished === "TRUE") {
        if (homeScore > awayScore) winnerDraw = game.home_team_name_en;
        else if (awayScore > homeScore) winnerDraw = game.away_team_name_en;
        else winnerDraw = "Draw";
      }

      const payload = {
        fulltime_a: homeScore,
        fulltime_b: awayScore,
        winner_draw: winnerDraw,
        fulltime: game.finished === "TRUE"
      };

      /*
      // Send update payload to Directus match item
      const directusResponse = await fetch(`${process.env.DIRECTUS_URL}/items/matches/${game.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        },
        body: JSON.stringify(payload)
      });
      */

      results.push({ 
        id: game.id, 
        teams: `${game.home_team_name_en} vs ${game.away_team_name_en}`,
        preparedPayload: payload 
      });
    }

    return response.status(200).json({ 
      success: true, 
      message: "Dry run complete.", 
      preview: results 
    });

  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}