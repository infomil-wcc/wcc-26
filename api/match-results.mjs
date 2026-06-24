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

  if (request.query?.calc === '1') {
    try {
      const debugLogs = await recalculateRankings(directusUrl, adminToken);
      return response.status(200).json({
        success: true,
        message: "Recalculation of predictions for all users completed successfully via manual trigger.",
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

  if (!forceAllMatches) {
    for (const dbMatch of dbMatches) {
      const matchTime = new Date(dbMatch.date).getTime();
      const hasStarted = nowTime >= matchTime;

      if (hasStarted && !dbMatch.fulltime) {
        const existingStatus = dbMatchStatuses.find(s => parseInt(s.match_id, 10) === parseInt(dbMatch.id, 10));
        if (!existingStatus) {
          try {
            const insertRes = await fetch(`${directusUrl}/items/match_status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
              },
              body: JSON.stringify({
                match_id: parseInt(dbMatch.id, 10),
                status: 'live',
                started_at: dbMatch.date
              })
            });
            if (insertRes.ok) {
              const insertData = await insertRes.json();
              dbMatchStatuses.push(insertData.data);
              console.log(`Inserted live status row for match ID ${dbMatch.id}`);
            }
          } catch (err) {
            console.error(`Failed to insert match_status for match ID ${dbMatch.id}:`, err.message);
          }
        }
      }
    }
  }

  const activeLiveMatchIds = dbMatchStatuses
    .filter(s => s.status !== 'finished')
    .map(s => parseInt(s.match_id, 10));

  const results = [];
  let calculationLogs = [];

  try {
    for (const dbMatch of dbMatches) {
      const matchIdNum = parseInt(dbMatch.id, 10);

      if (!forceAllMatches && queryId === null && !activeLiveMatchIds.includes(matchIdNum)) {
        continue;
      }

      const fdMatch = externalMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!fdMatch) continue;

      const wcMatch = wcMatches.find(m => {
        if (parseInt(dbMatch.id, 10) === parseInt(m.id, 10)) return true;
        const home = getNormalizedTeamName(m.home_team_name_en);
        const away = getNormalizedTeamName(m.away_team_name_en);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
      const homeScore = fdMatch.score?.fullTime?.home;
      const awayScore = fdMatch.score?.fullTime?.away;
      const dbScoreA = isReversed ? (awayScore !== null ? Number(awayScore) : null) : (homeScore !== null ? Number(homeScore) : null);
      const dbScoreB = isReversed ? (homeScore !== null ? Number(homeScore) : null) : (awayScore !== null ? Number(awayScore) : null);

      let scorers = [];
      if (wcMatch) {
        const homeGoals = parseScorersString(wcMatch.home_scorers, getNormalizedTeamName(wcMatch.home_team_name_en));
        const awayGoals = parseScorersString(wcMatch.away_scorers, getNormalizedTeamName(wcMatch.away_team_name_en));
        const combinedGoals = [...homeGoals, ...awayGoals];
        
        combinedGoals.sort((a, b) => {
          if (a.time.elapsed !== b.time.elapsed) {
            return a.time.elapsed - b.time.elapsed;
          }
          return (a.time.extra || 0) - (b.time.extra || 0);
        });
        
        scorers = combinedGoals;
      }

      let winner_draw = null;
      if (dbScoreA !== null && dbScoreB !== null) {
        if (dbScoreA > dbScoreB) {
          winner_draw = dbMatch.team_a;
        } else if (dbScoreA < dbScoreB) {
          winner_draw = dbMatch.team_b;
        } else {
          winner_draw = 'Draw';
        }
      }

      const isFinished = fdMatch.status === "FINISHED";
      const payload = {
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        scorers: scorers,
        winner_draw: winner_draw
      };

      const directusResponse = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      let directusError = null;
      if (!directusResponse.ok) {
        try {
          const errText = await directusResponse.text();
          directusError = JSON.parse(errText);
        } catch {
          directusError = `HTTP ${directusResponse.status}`;
        }
        console.error(`Directus PATCH failed for match ${dbMatch.id}:`, directusError);
      }

      results.push({
        id: dbMatch.id,
        teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
        status: "Updated",
        success: directusResponse.ok,
        ...(directusError ? { error: directusError } : {})
      });

      const statusObj = dbMatchStatuses.find(s => parseInt(s.match_id, 10) === matchIdNum);

      if (statusObj) {
        const matchStartedAt = new Date(statusObj.started_at || dbMatch.date).getTime();
        const elapsedMinutes = (new Date().getTime() - matchStartedAt) / (60 * 1000);
        const shouldFinish = elapsedMinutes >= 180 || isFinished;
        const newStatus = shouldFinish ? 'finished' : (queryId !== null || forceAllMatches ? 'live' : statusObj.status);
        
        if (shouldFinish || queryId !== null || forceAllMatches) {
          try {
            await fetch(`${directusUrl}/items/match_status/${statusObj.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
              },
              body: JSON.stringify({ status: newStatus })
            });
          } catch (err) {
            console.error(`Failed to update match_status for match ID ${dbMatch.id}:`, err.message);
          }
        }
      } else if (queryId !== null || (forceAllMatches && isFinished)) {
        const newStatus = isFinished ? 'finished' : 'live';
        try {
          await fetch(`${directusUrl}/items/match_status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              match_id: matchIdNum,
              status: newStatus,
              started_at: dbMatch.date
            })
          });
        } catch (err) {
          console.error(`Failed to create match_status for match ID ${dbMatch.id}:`, err.message);
        }
      }
    }

    if (results.length > 0) {
      calculationLogs = await recalculateRankings(directusUrl, adminToken);
    }

  } catch (error) {
    console.error("Data Sync Processing Error:", error);
    return response.status(500).json({ error: error.message });
  }

  return response.status(200).json({
    success: true,
    message: `Synchronisation complète effectuée. ${results.length} match(s) traités.`,
    updates: results,
    calculationLogs: calculationLogs
  });
}

async function recalculateRankings(directusUrl, adminToken) {
  const apiLogs = []; // Array to capture the required logging output
  try {
    console.log("Recalculating rankings...");
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    const matchesRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
    const matchesData = await matchesRes.json();
    const matches = matchesData.data || [];

    const predictionsRes = await fetch(`${directusUrl}/items/pronostiques?limit=-1`, { headers });
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
          
          const logMsg = `User: ${username} | Match ID: ${game.id} (${game.phase}) | Earned: ${pts} pts`;
          console.log(logMsg);
          apiLogs.push(logMsg);
        } else {
          const warnMsg = `⚠️ Prediction ${prono.id} has no matching played game for game_id: ${prono.game_id}`;
          console.log(warnMsg);
          apiLogs.push(warnMsg);
        }
      }

      rankingObj.push({
        key: username,
        point: totalPoints,
        pronostiques: userPronos
      });
    }

    rankingObj.sort((a, b) => {
      if (b.point !== a.point) {
        return b.point - a.point;
      }
      return a.key.localeCompare(b.key);
    });

    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) {
        rank = index + 1;
      }
      obj.rank = rank;
    });

    for (const player of rankingObj) {
      const rankingRow = {
        key: player.key,
        point: player.point,
        rank: player.rank,
        status: 'published',
        pronostiques: player.pronostiques
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
    }

    for (const existingItem of existingRankings) {
      const stillActive = rankingObj.some(player => player.key === existingItem.key);
      if (!stillActive) {
        await fetch(`${directusUrl}/items/pronostics_rankings/${existingItem.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
      }
    }

    console.log("Rankings recalculated successfully!");
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

  const halftime_a = pronostique.halftime_a;
  const halftime_b = pronostique.halftime_b;
  const fulltime_a = pronostique.fulltime_a;
  const fulltime_b = pronostique.fulltime_b;
  const winner_draw = pronostique.winner_draw;
  const scorers = pronostique.scorer;

  if (game.phase === 'Group Stage') {
    let point = (game.winner_draw === winner_draw) ? winner_point : 0;
    finalPoint += point;
  }

  if (game.phase === 'Round of 32' || game.phase === 'Round of 16') {
    let winnerPoint = (game.winner_draw === winner_draw) ? winner_point : 0;
    let fulltimePoint = (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b)) ? fulltime_point : 0;
    finalPoint += winnerPoint + fulltimePoint;
  }

  if (['Quarter-finals', 'Semi-finals', 'Third Place', 'Final'].includes(game.phase)) {
    let winnerPoint = (game.winner_draw === winner_draw) ? winner_point : 0;
    let fulltimePoint = (parseInt(game.fulltime_a) === parseInt(fulltime_a) && parseInt(game.fulltime_b) === parseInt(fulltime_b)) ? fulltime_point : 0;
    let halftimePoint = (parseInt(game.halftime_a) === parseInt(halftime_a) && parseInt(game.halftime_b) === parseInt(halftime_b)) ? halftime_point : 0;

    let gamescorers = [];
    if (game.scorers) {
      gamescorers = parseScorersStringForRanking(game.scorers);
    }
    let scorerPoint = (gamescorers.includes(scorers)) ? scorer_point : 0;

    finalPoint += winnerPoint + fulltimePoint + halftimePoint + scorerPoint;
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