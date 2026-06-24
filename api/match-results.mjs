import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

function parseScorersString(scorersStr, teamName) {
  if (!scorersStr || scorersStr === 'null' || scorersStr === '') return [];
  let cleanStr = scorersStr.replace(/[“”]/g, '"');
  
  let arr = [];
  try {
    const parsed = JSON.parse(cleanStr);
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else {
      const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
      if (matches) {
        arr = matches.map(m => m.replace(/^"|"$/g, ''));
      }
    }
  } catch (e) {
    const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    if (matches) {
      arr = matches.map(m => m.replace(/^"|"$/g, ''));
    }
  }

  const events = [];
  for (const goalStr of arr) {
    const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
    const match = goalStr.trim().match(regex);
    if (match) {
      const playerName = match[1].trim();
      const elapsed = parseInt(match[2], 10);
      const extra = match[3] ? parseInt(match[3], 10) : null;
      let detail = 'Normal Goal';
      if (match[4]) {
        const detailLower = match[4].toLowerCase();
        if (detailLower.includes('og') || detailLower.includes('csc')) {
          detail = 'Own Goal';
        } else if (detailLower.includes('p') || detailLower.includes('pen')) {
          detail = 'Penalty';
        }
      }
      events.push({
        time: { elapsed, extra },
        team: { name: teamName },
        player: { name: playerName },
        detail
      });
    } else {
      events.push({
        time: { elapsed: 0, extra: null },
        team: { name: teamName },
        player: { name: goalStr.trim() },
        detail: 'Normal Goal'
      });
    }
  }
  return events;
}

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

  // Extract points parameter parameters cleanly
  let targetUser = request.query?.points ? request.query.points.replace(/['"]/g, '').trim() : null;
  const isExplicitOverride = targetUser !== null; // True if ?points= is passed (even if it's 'all')
  const shouldCalcAll = request.query?.calc === '1' || targetUser === 'all';

  if (targetUser === 'all') {
    targetUser = null; 
  }

  // --- REVISED SECURITY RULES ---
  const authHeader = request.headers?.authorization || '';
  let loggedInUser = request.headers?.['x-user-id'] || request.headers?.['x-authenticated-user'] || null;

  // If there's NO explicit ?points overriding query string, enforce the logged-in user guard
  if (!isExplicitOverride && !shouldCalcAll) {
    if (!loggedInUser && !authHeader) {
      return response.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No user is logged in and no bypass parameter (?points=) was supplied. Aborting database sync."
      });
    }
  }
  // ------------------------------

  if (shouldCalcAll || targetUser || isExplicitOverride) {
    try {
      // Pass isExplicitOverride down to control whether we update the database for everyone
      const debugLogs = await recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride);
      return response.status(200).json({
        success: true,
        message: `Recalculation processed successfully. Persistence constraints applied.`,
        calculationLogs: debugLogs
      });
    } catch (calcError) {
      return response.status(500).json({
        success: false,
        error: "Failed manual ranking recalculation",
        details: calcError.message
      });
    }
  }

  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  const nowTime = new Date().getTime();
  const nowIso = new Date().toISOString();

  const forceAllMatches = request.query?.allmatches !== undefined;
  const queryIdParam = request.query?.id || request.query?.matchId;
  const queryId = queryIdParam ? parseInt(queryIdParam, 10) : null;

  let dbMatchStatuses = [];
  let _statusUrl = '';
  let _statusHttpStatus = null;
  let _statusRaw = '';
  try {
    const statusFilter = forceAllMatches 
      ? `?limit=-1`
      : (queryId !== null ? `?filter[match_id][eq]=${queryId}` : `?filter[status][neq]=finished`);
      
    _statusUrl = `${directusUrl}/items/match_status${statusFilter}`;
    const statusRes = await fetch(_statusUrl, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    _statusHttpStatus = statusRes.status;
    _statusRaw = await statusRes.text();
    if (statusRes.ok) {
      const statusData = JSON.parse(_statusRaw);
      dbMatchStatuses = statusData.data || [];
    }
  } catch (e) {
    console.error("Failed to fetch match_status:", e.message);
  }

  const liveMatchIds = dbMatchStatuses
    .filter(s => s.status !== 'finished')
    .map(s => parseInt(s.match_id, 10));

  let dbMatches = [];
  let _matchesUrl = '';
  let _matchesHttpStatus = null;
  let _matchesRaw = '';
  try {
    let matchesQuery = '';
    if (forceAllMatches) {
      matchesQuery = `?limit=-1`;
    } else if (queryId !== null) {
      matchesQuery = `?filter[id][eq]=${queryId}`;
    } else {
      matchesQuery = `?filter[or][0][date][lte]=${nowIso}&filter[or][0][fulltime][neq]=true`;
      if (liveMatchIds.length > 0) {
        matchesQuery += `&filter[or][1][id][in]=${liveMatchIds.join(',')}`;
      }
    }

    _matchesUrl = `${directusUrl}/items/matches${matchesQuery}`;
    const dbRes = await fetch(_matchesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    _matchesHttpStatus = dbRes.status;
    _matchesRaw = await dbRes.text();
    if (dbRes.ok) {
      const dbData = JSON.parse(_matchesRaw);
      dbMatches = dbData.data || [];
    }
  } catch (dbError) {
    console.error("Database Error fetching matches from Directus:", dbError.message);
  }

  if (dbMatches.length === 0 && dbMatchStatuses.length === 0) {
    if (queryId !== null) {
      return response.status(200).json({
        success: false,
        message: `No match or status found in Directus for id=${queryId}. Check the diagnostic info below.`,
        diagnostic: {
          matchesUrl: _matchesUrl,
          matchesHttpStatus: _matchesHttpStatus,
          matchesBody: (() => { try { return JSON.parse(_matchesRaw); } catch { return _matchesRaw; } })(),
          statusUrl: _statusUrl,
          statusHttpStatus: _statusHttpStatus,
          statusBody: (() => { try { return JSON.parse(_statusRaw); } catch { return _statusRaw; } })()
        }
      });
    }
    return response.status(200).json({
      success: true,
      message: "No started or live matches require syncing.",
      updates: [],
      formUpdates: []
    });
  }

  let externalMatches = [];

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

  let wcMatches = [];
  try {
    const wcRes = await fetch('https://worldcup26.ir/get/games');
    if (wcRes.ok) {
      const wcData = await wcRes.json();
      wcMatches = wcData.games || [];
    }
  } catch (wcError) {
    console.error("Error fetching from worldcup26.ir:", wcError.message);
  }

  const results = [];
  let calculationLogs = [];

  try {
    for (const dbMatch of dbMatches) {
      const matchIdNum = parseInt(dbMatch.id, 10);
      const fdMatch = externalMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!fdMatch) continue;

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
      const homeScore = fdMatch.score?.fullTime?.home;
      const awayScore = fdMatch.score?.fullTime?.away;
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      results.push({
        id: dbMatch.id,
        teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
        status: "Updated",
        success: true
      });
    }

    if (results.length > 0) {
      calculationLogs = await recalculateRankings(directusUrl, adminToken, null, loggedInUser, false);
    }

  } catch (error) {
    console.error("Data Sync Processing Error:", error);
    return response.status(500).json({ error: error.message });
  }

  return response.status(200).json({
    success: true,
    message: `Synchronisation complète effectuée.`,
    updates: results,
    calculationLogs: calculationLogs
  });
}

async function recalculateRankings(directusUrl, adminToken, specificUser = null, loggedInUser = null, isExplicitOverride = false) {
  const apiLogs = [];
  try {
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    const matchesRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
    const matchesData = await matchesRes.json();
    const matches = matchesData.data || [];

    const pronoFilter = specificUser ? `&filter[user][eq]=${specificUser}` : "";
    const predictionsRes = await fetch(`${directusUrl}/items/pronostiques?limit=-1${pronoFilter}`, { headers });
    const predictionsData = await predictionsRes.json();
    const predictions = predictionsData.data || [];

    const rankingsRes = await fetch(`${directusUrl}/items/pronostics_rankings?limit=-1`, { headers });
    const rankingsData = await rankingsRes.json();
    const existingRankings = rankingsData.data || [];

    const playedMatches = matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null);

    const userPredictions = {};
    for (const prono of predictions) {
      if (!prono.user) continue;
      if (!userPredictions[prono.user]) {
        userPredictions[prono.user] = [];
      }
      userPredictions[prono.user].push(prono);
    }

    const rankingObj = [];
    for (const username of Object.keys(userPredictions)) {
      let totalPoints = 0;
      const userPronos = userPredictions[username].map(prono => ({
        id: prono.id,
        game_id: prono.game_id,
        user: prono.user,
        winner_draw: prono.winner_draw,
        fulltime_a: prono.fulltime_a,
        fulltime_b: prono.fulltime_b,
        halftime_a: prono.halftime_a,
        halftime_b: prono.halftime_b,
        scorer: prono.scorer
      }));

      for (const prono of userPredictions[username]) {
        const game = playedMatches.find(m => String(m.id) === String(prono.game_id));
        if (game) {
          const pts = calcResultForRanking(game, prono);
          totalPoints += pts;
          apiLogs.push(`User: ${username} | Match ID: ${game.id} | Earned: ${pts} pts`);
        }
      }

      rankingObj.push({
        key: username,
        point: totalPoints,
        pronostiques: userPronos
      });
    }

    rankingObj.sort((a, b) => b.point - a.point || a.key.localeCompare(b.key));
    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) {
        rank = index + 1;
      }
      obj.rank = rank;
    });

    // --- REVISED PERSISTENCE LOGIC ---
    for (const player of rankingObj) {
      // Rule: Update database IF a query override (?points=) is active OR this player is the authenticated user
      const isTargetedUser = specificUser !== null ? (player.key === specificUser) : true;
      const shouldSaveToDb = isExplicitOverride ? isTargetedUser : (player.key === loggedInUser);

      if (!shouldSaveToDb) continue;

      const rankingRow = {
        key: player.key,
        point: player.point,
        rank: player.rank,
        status: 'published'
      };

      const existingRow = existingRankings.find(item => item.key === player.key);

      if (existingRow) {
        await fetch(`${directusUrl}/items/pronostics_rankings/${existingRow.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(rankingRow)
        });
      } else {
        await fetch(`${directusUrl}/items/pronostics_rankings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(rankingRow)
        });
      }
      apiLogs.push(`Saved row in Directus for user: ${player.key}`);
    }

    // Cleanup step (only if running a global override sync)
    if (isExplicitOverride && specificUser === null) {
      for (const existingItem of existingRankings) {
        const stillActive = rankingObj.some(player => player.key === existingItem.key);
        if (!stillActive) {
          await fetch(`${directusUrl}/items/pronostics_rankings/${existingItem.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
          });
        }
      }
    }

    return apiLogs;
  } catch (err) {
    console.error("Error during ranking recalculation:", err);
    throw err;
  }
}

function calcResultForRanking(game, pronostique) {
  if (!game || !pronostique) return 0;
  if (game.fulltime_a === null || game.fulltime_b === null) return 0;

  let finalPoint = 0;
  const winner_point = Number(game.winner_point) || 0;
  const halftime_point = Number(game.halftime_point) || 0;
  const fulltime_point = Number(game.fulltime_point) || 0;
  const scorer_point = Number(game.scorer_point) || 0;

  if (game.phase === 'Group Stage') {
    if (game.winner_draw === pronostique.winner_draw) finalPoint += winner_point;
  }

  if (game.phase === 'Round of 32' || game.phase === 'Round of 16') {
    if (game.winner_draw === pronostique.winner_draw) finalPoint += winner_point;
    if (parseInt(game.fulltime_a) === parseInt(pronostique.fulltime_a) && parseInt(game.fulltime_b) === parseInt(pronostique.fulltime_b)) finalPoint += fulltime_point;
  }

  if (['Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(game.phase)) {
    if (game.winner_draw === pronostique.winner_draw) finalPoint += winner_point;
    if (parseInt(game.fulltime_a) === parseInt(pronostique.fulltime_a) && parseInt(game.fulltime_b) === parseInt(pronostique.fulltime_b)) finalPoint += fulltime_point;
    if (parseInt(game.halftime_a) === parseInt(pronostique.halftime_a) && parseInt(game.halftime_b) === parseInt(pronostique.halftime_b)) finalPoint += halftime_point;

    let gamescorers = [];
    if (game.scorers) {
      gamescorers = parseScorersStringForRanking(game.scorers);
    }
    if (gamescorers.includes(pronostique.scorer)) finalPoint += scorer_point;
  }

  return finalPoint;
}

function parseScorersStringForRanking(scorersStr) {
  if (!scorersStr || scorersStr === 'null' || scorersStr === '') return [];
  let cleanStr = scorersStr.replace(/[“”]/g, '"');
  let arr = [];
  try {
    const parsed = JSON.parse(cleanStr);
    if (Array.isArray(parsed)) {
      arr = parsed.map(e => e.player?.name || e.scorer?.name).filter(Boolean);
    } else {
      const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
      if (matches) {
        arr = matches.map(m => m.replace(/^"|"$/g, ''));
      }
    }
  } catch (e) {
    const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    if (matches) {
      arr = matches.map(m => m.replace(/^"|"$/g, ''));
    }
  }
  return arr.map(s => s.trim());
}