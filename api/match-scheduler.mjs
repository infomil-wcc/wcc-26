import { handleCors } from './utils.mjs';
import { 
  getNormalizedTeamName, 
  getNormalizedPhase, 
  getDbMatchUtcTime, 
  getFdMatchUtcTime, 
  getWcGameApproxUtcTime,
  parseScorersString,
  recalculateRankings
} from './match-results.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  const { matchId, action } = request.body || {};

  if (!matchId || !action) {
    return response.status(400).json({ error: "Missing matchId or action in request body." });
  }

  try {
    // 1. Fetch the Directus dbMatch details to get the teams/phase/date
    const dbMatchRes = await fetch(`${directusUrl}/items/matches/${matchId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!dbMatchRes.ok) {
      throw new Error(`Directus match lookup failed: ${dbMatchRes.statusText}`);
    }
    const dbMatchData = await dbMatchRes.json();
    const dbMatch = dbMatchData.data;

    if (!dbMatch) {
      return response.status(404).json({ error: `Match ID ${matchId} not found in Directus.` });
    }

    if (action === 'live') {
      // Find the match_status record for this match and set it to 'live'
      const statusRes = await fetch(`${directusUrl}/items/match_status?filter[match_id][eq]=${matchId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const statusRecord = (statusData.data || [])[0];
        if (statusRecord) {
          await fetch(`${directusUrl}/items/match_status/${statusRecord.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'live' })
          });
        }
      }
      return response.status(200).json({ success: true, message: `Match ${matchId} status updated to live.` });
    }

    if (action === 'halftime') {
      // Fetch halftime scores from football-data
      const apiRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': apiKey }
      });
      if (!apiRes.ok) {
        throw new Error(`Football-data WC matches lookup failed: ${apiRes.statusText}`);
      }
      const data = await apiRes.json();
      const externalMatches = data.matches || [];

      const dbUtcTime = getDbMatchUtcTime(dbMatch.date);
      const fdMatch = externalMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        const namesMatch = (dbMatch.team_a === home && dbMatch.team_b === away) ||
                           (dbMatch.team_a === away && dbMatch.team_b === home);
        if (!namesMatch) return false;

        const dbPhase = dbMatch.phase;
        const fdPhase = getNormalizedPhase(m.stage);
        if (dbPhase && fdPhase && dbPhase !== fdPhase) return false;

        const fdUtcTime = getFdMatchUtcTime(m.utcDate);
        if (dbUtcTime && fdUtcTime && Math.abs(dbUtcTime - fdUtcTime) > 30 * 60 * 60 * 1000) return false;

        return true;
      });

      if (!fdMatch) {
        return response.status(404).json({ error: "No matching external match found on football-data." });
      }

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
      const htHome = fdMatch.score?.halfTime?.home;
      const htAway = fdMatch.score?.halfTime?.away;
      const dbHalftimeA = isReversed ? (htAway !== null ? Number(htAway) : null) : (htHome !== null ? Number(htHome) : null);
      const dbHalftimeB = isReversed ? (htHome !== null ? Number(htHome) : null) : (htAway !== null ? Number(htAway) : null);

      if (dbHalftimeA !== null && dbHalftimeB !== null) {
        const payload = {
          halftime_a: dbHalftimeA,
          halftime_b: dbHalftimeB
        };
        await fetch(`${directusUrl}/items/matches/${matchId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(payload)
        });
        return response.status(200).json({ success: true, message: `Halftime score updated for match ${matchId}.` });
      }
      return response.status(200).json({ success: true, message: `No halftime score available yet for match ${matchId}.` });
    }

    if (action === 'fulltime') {
      // 1. Fetch scores from football-data
      const fdRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': apiKey }
      });
      const fdData = fdRes.ok ? await fdRes.json() : {};
      const externalMatches = fdData.matches || [];

      // 2. Fetch scorers from worldcup26.ir
      let wcGames = [];
      try {
        const wcRes = await fetch('https://worldcup26.ir/get/games', {
          headers: {
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (wcRes.ok) {
          const wcData = await wcRes.json();
          wcGames = wcData.games || [];
        }
      } catch (wcErr) {
        console.error("Failed to fetch worldcup26.ir in scheduler:", wcErr.message);
      }

      const dbUtcTime = getDbMatchUtcTime(dbMatch.date);

      const fdMatch = externalMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        const namesMatch = (dbMatch.team_a === home && dbMatch.team_b === away) ||
                           (dbMatch.team_a === away && dbMatch.team_b === home);
        if (!namesMatch) return false;

        const dbPhase = dbMatch.phase;
        const fdPhase = getNormalizedPhase(m.stage);
        if (dbPhase && fdPhase && dbPhase !== fdPhase) return false;

        const fdUtcTime = getFdMatchUtcTime(m.utcDate);
        if (dbUtcTime && fdUtcTime && Math.abs(dbUtcTime - fdUtcTime) > 30 * 60 * 60 * 1000) return false;

        return true;
      });

      const wcGame = wcGames.find(g => {
        const home = getNormalizedTeamName(g.home_team_name_en);
        const away = getNormalizedTeamName(g.away_team_name_en);
        const namesMatch = (dbMatch.team_a === home && dbMatch.team_b === away) ||
                           (dbMatch.team_a === away && dbMatch.team_b === home);
        if (!namesMatch) return false;

        const dbPhase = dbMatch.phase;
        const wcPhase = getNormalizedPhase(g.type);
        if (dbPhase && wcPhase && dbPhase !== wcPhase) return false;

        const wcUtcTime = getWcGameApproxUtcTime(g.local_date);
        if (dbUtcTime && wcUtcTime && Math.abs(dbUtcTime - wcUtcTime) > 30 * 60 * 60 * 1000) return false;

        return true;
      });

      if (!fdMatch) {
        return response.status(404).json({ error: "No matching external match found on football-data for fulltime sync." });
      }

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
      const homeScore = fdMatch.score?.fullTime?.home;
      const awayScore = fdMatch.score?.fullTime?.away;
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      const htHome = fdMatch.score?.halfTime?.home;
      const htAway = fdMatch.score?.halfTime?.away;
      const dbHalftimeA = isReversed ? (htAway !== null ? Number(htAway) : null) : (htHome !== null ? Number(htHome) : null);
      const dbHalftimeB = isReversed ? (htHome !== null ? Number(htHome) : null) : (htAway !== null ? Number(htAway) : null);

      let winner_draw = null;
      if (dbScoreA !== null && dbScoreB !== null) {
        if (dbScoreA > dbScoreB) winner_draw = dbMatch.team_a;
        else if (dbScoreA < dbScoreB) winner_draw = dbMatch.team_b;
        else winner_draw = 'Draw';
      }

      const payload = {
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        winner_draw: winner_draw
      };

      if (dbHalftimeA !== null && dbHalftimeB !== null) {
        payload.halftime_a = dbHalftimeA;
        payload.halftime_b = dbHalftimeB;
      }

      if (wcGame) {
        const homeScorers = parseScorersString(wcGame.home_scorers, getNormalizedTeamName(wcGame.home_team_name_en));
        const awayScorers = parseScorersString(wcGame.away_scorers, getNormalizedTeamName(wcGame.away_team_name_en));
        const combinedScorers = [...homeScorers, ...awayScorers];
        payload.scorers = combinedScorers;
      }

      // Update match details
      await fetch(`${directusUrl}/items/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      // Update match_status to finished
      const statusRes = await fetch(`${directusUrl}/items/match_status?filter[match_id][eq]=${matchId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const statusRecord = (statusData.data || [])[0];
        if (statusRecord) {
          await fetch(`${directusUrl}/items/match_status/${statusRecord.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'finished' })
          });
        }
      }

      // Recalculate rankings
      const calculationLogs = await recalculateRankings(directusUrl, adminToken, null, null, true);

      return response.status(200).json({
        success: true,
        message: `Match ${matchId} sync complete and status updated to finished.`,
        calculationLogs
      });
    }

    return response.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error("Scheduler Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
