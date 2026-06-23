import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'POST' && request.method !== 'GET') {
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
    return response.status(500).json({ error: "Missing DIRECTUS_ADMIN_TOKEN environment variable." });
  }
  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  try {
    // 1. Fetch matches from football-data (counts as 1 API call)
    const fdRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': apiKey }
    });
    if (!fdRes.ok) {
      throw new Error(`Football-Data API failed: ${fdRes.status}`);
    }
    const fdData = await fdRes.json();
    const externalMatches = fdData.matches || [];

    // 2. Fetch matches from Directus
    const dbRes = await fetch(`${directusUrl}/items/matches?limit=-1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!dbRes.ok) {
      throw new Error(`Directus failed to fetch matches: ${dbRes.status}`);
    }
    const dbData = await dbRes.json();
    const dbMatches = dbData.data || [];

    const finishedMatches = externalMatches.filter(m => m.status === 'FINISHED');
    dbMatches.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    const results = [];
    let apiCallsCount = 1; // 1 call already made for matches list

    for (const dbMatch of dbMatches) {
      // Limit to 8 detailed queries per execution to avoid Vercel timeouts (60s limit)
      // and ensure total API calls to football-data (including the list call) do not exceed 9 calls in 60s
      if (apiCallsCount >= 9) {
        console.log("Reached rate limit threshold of 9 API calls per execution. Stopping here.");
        break;
      }

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

      let winnerDraw = "Draw";
      if (dbScoreA > dbScoreB) {
        winnerDraw = dbMatch.team_a;
      } else if (dbScoreB > dbScoreA) {
        winnerDraw = dbMatch.team_b;
      }

      // Needs update check
      const needsUpdate = 
        dbMatch.fulltime_a !== dbScoreA ||
        dbMatch.fulltime_b !== dbScoreB ||
        dbMatch.winner_draw !== winnerDraw ||
        !dbMatch.scorers || dbMatch.scorers === 'null';

      if (!needsUpdate) continue;

      // Rate Limit: 6.8 seconds delay between calls to guarantee not calling more than 9 times in 60s
      console.log(`Waiting 6.8 seconds before fetching scorers for Match ${dbMatch.id}...`);
      await delay(6800);

      let scorers = '';
      try {
        const detailRes = await fetch(`https://api.football-data.org/v4/matches/${extMatch.id}`, {
          headers: { 'X-Auth-Token': apiKey }
        });
        apiCallsCount++;

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const scorersList = (detailData.goals || [])
            .map(g => g.scorer?.name)
            .filter(Boolean);
          scorers = scorersList.length > 0 ? scorersList.join(', ') : '';
        }
      } catch (err) {
        console.error(`Scorers fetch error for Match ${dbMatch.id}:`, err.message);
      }

      const payload = {
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winnerDraw,
        scorers: scorers
      };

      const htHome = extMatch.score?.halfTime?.home;
      const htAway = extMatch.score?.halfTime?.away;
      if (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) {
        payload.halftime_a = isReversed ? htAway : htHome;
        payload.halftime_b = isReversed ? htHome : htAway;
      }

      const patchRes = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
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
        success: patchRes.ok
      });
    }

    return response.status(200).json({
      success: true,
      message: `Completed sync step. Updated ${results.length} matches.`,
      apiCallsMade: apiCallsCount,
      updates: results
    });

  } catch (error) {
    console.error("Catch-up API error:", error);
    return response.status(500).json({ error: error.message });
  }
}
