import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

/**
 * Helper function to clean and map team names
 */
function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let directusUrl = process.env.DIRECTUS_URL;
  if (!directusUrl || directusUrl === 'undefined') {
    directusUrl = 'https://euro.omediainteractive.net/imleuro';
  }
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  let externalMatches = [];

  // Fetch from football-data.org API
  try {
    const apiRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      method: 'GET',
      headers: {
        'X-Auth-Token': apiKey
      }
    });

    if (!apiRes.ok) {
      throw new Error(`Football-Data API responded with HTTP status ${apiRes.status}`);
    }

    const data = await apiRes.json();
    externalMatches = data.matches || [];

  } catch (networkError) {
    console.error("Network Error fetching from football-data.org:", networkError.message);
    return response.status(503).json({
      success: false,
      error: "External Football-Data API is currently unreachable or offline.",
      details: networkError.message
    });
  }

  // Fetch all matches from Directus to do mapping
  let dbMatches = [];
  try {
    const dbRes = await fetch(`${directusUrl}/items/matches?limit=-1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!dbRes.ok) {
      throw new Error(`Directus match fetch failed with HTTP status ${dbRes.status}`);
    }

    const dbData = await dbRes.json();
    dbMatches = dbData.data || [];
  } catch (dbError) {
    console.error("Database Error fetching matches from Directus:", dbError.message);
    return response.status(500).json({
      success: false,
      error: "Failed to retrieve local matches from Directus database.",
      details: dbError.message
    });
  }

  // Map and update matches
  const results = [];

  try {
    for (const extMatch of externalMatches) {
      // Sync completed matches OR in-play/paused matches to capture halftime scores
      if (extMatch.status !== "FINISHED" && extMatch.status !== "IN_PLAY" && extMatch.status !== "PAUSED") {
        continue;
      }

      const normalizedHome = getNormalizedTeamName(extMatch.homeTeam?.name);
      const normalizedAway = getNormalizedTeamName(extMatch.awayTeam?.name);

      if (!normalizedHome || !normalizedAway) {
        continue;
      }

      // Find the corresponding Directus match by comparing normalized team names (allowing reversed home/away slots)
      const dbMatch = dbMatches.find(m => 
        (m.team_a === normalizedHome && m.team_b === normalizedAway) ||
        (m.team_a === normalizedAway && m.team_b === normalizedHome)
      );

      if (!dbMatch) {
        console.warn(`No match found in DB for external match: ${normalizedHome} vs ${normalizedAway}`);
        continue;
      }

      // Determine home/away scores mapping based on whether the team positions are reversed
      const isReversed = (dbMatch.team_a === normalizedAway);
      const homeScore = extMatch.score?.fullTime?.home;
      const awayScore = extMatch.score?.fullTime?.away;

      const payload = {};

      // Only sync full-time stats if finished
      if (extMatch.status === "FINISHED" && homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) {
        const dbScoreA = isReversed ? awayScore : homeScore;
        const dbScoreB = isReversed ? homeScore : awayScore;

        let winnerDraw = null;
        if (dbScoreA > dbScoreB) {
          winnerDraw = dbMatch.team_a;
        } else if (dbScoreB > dbScoreA) {
          winnerDraw = dbMatch.team_b;
        } else {
          winnerDraw = "Draw";
        }

        const scorersList = (extMatch.goals || [])
          .map(g => g.scorer?.name)
          .filter(Boolean);
        const scorers = scorersList.length > 0 ? scorersList.join(', ') : '';

        payload.fulltime_a = dbScoreA;
        payload.fulltime_b = dbScoreB;
        payload.winner_draw = winnerDraw;
        payload.fulltime = true;
        payload.scorers = scorers;
      }

      // Extract halftime scores if available
      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      if (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) {
        payload.halftime_a = isReversed ? htAway : htHome;
        payload.halftime_b = isReversed ? htHome : htAway;
        payload.halftime = true;
      }

      // If there's nothing new to update, skip it
      if (Object.keys(payload).length === 0) {
        continue;
      }

      // Send update payload to Directus match item
      const directusResponse = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      results.push({
        id: dbMatch.id,
        teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
        status: "Updated",
        success: directusResponse.ok
      });
    }

  } catch (error) {
    console.error("Data Sync Processing Error:", error);
    return response.status(500).json({ error: error.message });
  }

  // ── Phase 2: Update team form (forme1–forme5) ──────────────────────────
  const formUpdates = [];
  try {
    // Fetch all teams from Directus (we need id + name)
    const teamsRes = await fetch(`${directusUrl}/items/teams?limit=-1&fields=id,name`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!teamsRes.ok) {
      throw new Error(`Directus teams fetch failed with HTTP status ${teamsRes.status}`);
    }

    const teamsData = await teamsRes.json();
    const dbTeams = teamsData.data || [];

    // Build a map: normalizedTeamName -> { id }
    const teamMap = {};
    for (const t of dbTeams) {
      teamMap[t.name] = t;
    }

    // Collect finished matches sorted chronologically (oldest first)
    const finishedMatches = externalMatches
      .filter(m => m.status === "FINISHED")
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    // Build per-team list of outcomes in chronological order
    const teamOutcomes = {}; // teamName -> ['W','D','L', ...]

    for (const m of finishedMatches) {
      const homeScore = m.score?.fullTime?.home;
      const awayScore = m.score?.fullTime?.away;
      if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
        continue;
      }

      const homeName = getNormalizedTeamName(m.homeTeam?.name);
      const awayName = getNormalizedTeamName(m.awayTeam?.name);

      if (!homeName || !awayName) continue;

      let homeOutcome, awayOutcome;
      if (homeScore > awayScore) {
        homeOutcome = 'W'; awayOutcome = 'L';
      } else if (awayScore > homeScore) {
        homeOutcome = 'L'; awayOutcome = 'W';
      } else {
        homeOutcome = 'D'; awayOutcome = 'D';
      }

      if (!teamOutcomes[homeName]) teamOutcomes[homeName] = [];
      if (!teamOutcomes[awayName]) teamOutcomes[awayName] = [];
      teamOutcomes[homeName].push(homeOutcome);
      teamOutcomes[awayName].push(awayOutcome);
    }

    // For each team with outcomes, PATCH forme1–forme5 (most recent last → forme5 is newest)
    for (const [teamName, outcomes] of Object.entries(teamOutcomes)) {
      const dbTeam = teamMap[teamName];
      if (!dbTeam) {
        console.warn(`Team not found in Directus: ${teamName}`);
        continue;
      }

      // Take last 5 results; pad with empty string if fewer than 5 games played
      const last5 = outcomes.slice(-5);
      while (last5.length < 5) last5.unshift('');

      const formPayload = {
        forme1: last5[0],
        forme2: last5[1],
        forme3: last5[2],
        forme4: last5[3],
        forme5: last5[4]
      };

      const formRes = await fetch(`${directusUrl}/items/teams/${dbTeam.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(formPayload)
      });

      formUpdates.push({
        team: teamName,
        id: dbTeam.id,
        form: last5.join(''),
        success: formRes.ok
      });
    }

  } catch (formError) {
    console.error("Team Form Update Error:", formError.message);
    // Non-fatal: still return match results even if form update fails
    return response.status(200).json({
      success: true,
      message: `Synchronisation effectuée. ${results.length} matchs mis à jour. Erreur lors de la mise à jour de la forme des équipes.`,
      updates: results,
      formUpdates: [],
      formError: formError.message
    });
  }

  return response.status(200).json({
    success: true,
    message: `Synchronisation football-data effectuée. ${results.length} matchs terminés mis à jour. ${formUpdates.length} équipes mises à jour.`,
    updates: results,
    formUpdates
  });
}