import { handleCors, fetchWithBypass } from './utils.mjs';
const fetch = fetchWithBypass;
import { 
  getNormalizedTeamName, 
  getNormalizedPhase, 
  getDbMatchUtcTime, 
  getFdMatchUtcTime, 
  getWcGameApproxUtcTime,
  parseScorersString,
  recalculateRankings,
  hasMatchChanged,
  autoAdvanceKnockoutStages
} from './match-results.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) return;

  // Secure the cron endpoint by checking Vercel's CRON_SECRET if running in production
  const authHeader = request.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return response.status(401).json({ error: 'Unauthorized: Cron Secret Mismatch' });
    }
  }

  // Accept GET or POST to allow crons/scheduled queries
  if (request.method !== 'POST' && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  // Extract from body or query params to handle both GET/POST crons or target requests
  const bodyData = request.body || {};
  const queryData = request.query || {};
  const matchId = bodyData.matchId || queryData.matchId || bodyData.match_id || queryData.match_id;

  try {
    let dbMatches = [];
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    if (matchId) {
      // 1. Target match execution
      const dbMatchRes = await fetch(`${directusUrl}/items/matches/${matchId}`, { headers });
      if (!dbMatchRes.ok) {
        throw new Error(`Directus match lookup failed: ${dbMatchRes.statusText}`);
      }
      const dbMatchData = await dbMatchRes.json();
      if (dbMatchData.data) {
        dbMatches.push(dbMatchData.data);
      }
    } else {
      // 2. Scan mode: fetch matches where the match time has started/passed
      // Fetch all matches to scan timezone comparisons safely
      const dbRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
      if (!dbRes.ok) {
        throw new Error(`Directus list matches lookup failed: ${dbRes.statusText}`);
      }
      const dbData = await dbRes.json();
      const allMatches = dbData.data || [];
      const nowMs = Date.now();

      for (const m of allMatches) {
        const matchUtcTime = getDbMatchUtcTime(m.date);
        // Only consider matches that have started
        if (matchUtcTime && matchUtcTime <= nowMs) {
          // Safeguard check: query only if status_updated is missing
          // OR status_updated is earlier than the match time.
          if (!m.status_updated) {
            dbMatches.push(m);
          } else {
            const statusUpdatedMs = new Date(m.status_updated).getTime();
            if (statusUpdatedMs < matchUtcTime) {
              dbMatches.push(m);
            }
          }
        }
      }
    }

    if (dbMatches.length === 0) {
      return response.status(200).json({ success: true, message: "No matches require updating or syncing." });
    }

    // 1. Fetch scores from football-data
    let externalMatches = [];
    try {
      const apiRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': apiKey }
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        externalMatches = data.matches || [];
      }
    } catch (fdErr) {
      console.error("Failed to fetch football-data.org:", fdErr.message);
    }

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

    const updates = [];
    const nowIso = new Date().toISOString();

    for (const dbMatch of dbMatches) {
      const dbUtcTime = getDbMatchUtcTime(dbMatch.date);

      // Find match on football-data
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

      // Find match on worldcup26.ir
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
        console.warn(`No matching external match found on football-data for Match ID: ${dbMatch.id}`);
        continue;
      }

      // Check external match status to determine current_status
      // football-data.org statuses: 'FINISHED', 'IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', etc.
      let newStatus = 'pending';
      const fdStatus = fdMatch.status ? fdMatch.status.toUpperCase() : '';
      if (fdStatus === 'FINISHED' || fdStatus === 'AWARDED') {
        newStatus = 'finished';
      } else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(fdStatus)) {
        newStatus = 'live';
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
        winner_draw: winner_draw,
        current_status: newStatus,
        status_updated: nowIso
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

      // Update match details in Directus
      let directusResponseOk = true;
      if (hasMatchChanged(dbMatch, payload)) {
        const directusResponse = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(payload)
        });
        directusResponseOk = directusResponse.ok;
      }

      updates.push({
        id: dbMatch.id,
        teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
        current_status: newStatus,
        success: directusResponseOk
      });
    }

    let calculationLogs = [];
    let knockoutUpdates = [];
    if (updates.some(u => u.success && u.current_status === 'finished')) {
      try {
        knockoutUpdates = await autoAdvanceKnockoutStages(directusUrl, adminToken);
      } catch (advanceErr) {
        console.error("Failed to advance knockout matches automatically in scheduler:", advanceErr.message);
      }
      calculationLogs = await recalculateRankings(directusUrl, adminToken, null, null, true);
    }

    return response.status(200).json({
      success: true,
      message: `Match update processing complete.`,
      updates,
      knockoutUpdates,
      calculationLogs
    });

  } catch (error) {
    console.error("Scheduler Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
