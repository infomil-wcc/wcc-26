import { handleCors, fetchWithBypass } from './utils.mjs';
const fetch = fetchWithBypass;
import { teamNameMap, phaseMap } from './mappings.mjs';

export function getNormalizedTeamName(externalName) {
  if (!externalName) return null;
  const trimmedName = externalName.trim();
  return teamNameMap[trimmedName] || trimmedName;
}

export function getNormalizedPhase(apiType) {
  if (!apiType) return null;
  const lowerType = apiType.toLowerCase().trim();
  return phaseMap[lowerType] || lowerType;
}

export function getDbMatchUtcTime(dbDateStr) {
  if (!dbDateStr) return 0;
  // dbDateStr is e.g. "2026-06-14 08:00:00" in Mauritius timezone (+04:00)
  const isoStr = dbDateStr.trim().replace(' ', 'T') + '+04:00';
  return new Date(isoStr).getTime();
}

export function getFdMatchUtcTime(utcDateStr) {
  if (!utcDateStr) return 0;
  return new Date(utcDateStr).getTime();
}

export function getWcGameApproxUtcTime(localDateStr) {
  if (!localDateStr) return 0;
  // localDateStr is e.g. "06/13/2026 21:00"
  const [datePart, timePart] = localDateStr.split(' ');
  const [month, day, year] = datePart.split('/');
  const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00'}:00Z`;
  return new Date(isoStr).getTime();
}

export function parseScorersString(scorersStr, teamName) {
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
    // If it's already an object (e.g. parsed from existing array in db/elsewhere), keep it
    if (typeof goalStr === 'object' && goalStr !== null) {
      events.push(goalStr);
      continue;
    }
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

export function hasMatchChanged(dbMatch, payload) {
  if (dbMatch.fulltime_a != payload.fulltime_a) return true;
  if (dbMatch.fulltime_b != payload.fulltime_b) return true;
  if (dbMatch.halftime_a != payload.halftime_a) return true;
  if (dbMatch.halftime_b != payload.halftime_b) return true;
  if (dbMatch.winner_draw != payload.winner_draw) return true;
  if (dbMatch.current_status != payload.current_status) return true;

  if (payload.scorers) {
    const dbScorers = dbMatch.scorers || [];
    const payScorers = payload.scorers || [];
    
    let dbScorerNames = [];
    if (Array.isArray(dbScorers)) {
      dbScorerNames = dbScorers.map(s => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || '')).filter(Boolean);
    } else if (typeof dbScorers === 'string') {
      try {
        const parsed = JSON.parse(dbScorers);
        if (Array.isArray(parsed)) {
          dbScorerNames = parsed.map(s => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || '')).filter(Boolean);
        }
      } catch (e) {
        dbScorerNames = [dbScorers];
      }
    }

    const payScorerNames = payScorers.map(s => typeof s === 'string' ? s : (s.player?.name || s.scorer?.name || '')).filter(Boolean);

    if (dbScorerNames.length !== payScorerNames.length) return true;
    for (let i = 0; i < payScorerNames.length; i++) {
      if (dbScorerNames[i] !== payScorerNames[i]) return true;
    }
  }

  return false;
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

  // Safe query extraction fallback
  const queryData = request.query || {};

  // Extract query parameters
  const matchesParam = queryData.matches ? queryData.matches.replace(/['"]/g, '').trim() : null;
  const pointsParam = queryData.points ? queryData.points.replace(/['"]/g, '').trim() : null;

  // Combination: ?matches=all&points=all
  const shouldSyncAndCalcAll = (matchesParam === 'all' && pointsParam === 'all');

  // Recalculate options
  const shouldCalcAll = (pointsParam === 'all' && matchesParam !== 'all');
  let targetUser = (pointsParam && pointsParam !== 'all') ? pointsParam : null;

  // Match Sync options (if not combination)
  const shouldSyncMatches = matchesParam !== null && !shouldSyncAndCalcAll;
  const syncMatchId = (matchesParam && matchesParam !== 'all') ? parseInt(matchesParam, 10) : null;

  // Check if force bypass params exist to allow unauthorized requests
  const isExplicitOverride = matchesParam !== null || pointsParam !== null;

  // FIXED: Bulletproof fallback headers wrapper object to stop Vercel Invocation crashes
  const headersData = request.headers || {};
  const authHeader = headersData.authorization || '';
  let loggedInUser = headersData['x-user-id'] || headersData['x-authenticated-user'] || null;

  // Enforce session check ONLY if no explicit override query is running
  if (!isExplicitOverride) {
    if (!loggedInUser && !authHeader) {
      return response.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No user session detected and no override parameter passed."
      });
    }
  }

  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  const results = [];
  let calculationLogs = [];
  let knockoutUpdates = [];

  try {
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    if (shouldSyncAndCalcAll || shouldSyncMatches) {
      const dbUrl = syncMatchId ? `${directusUrl}/items/matches/${syncMatchId}` : `${directusUrl}/items/matches?limit=-1`;
      
      const [dbRes, apiRes, wcRes] = await Promise.all([
        fetch(dbUrl, { headers }),
        fetch('https://api.football-data.org/v4/competitions/WC/matches', {
          headers: { 'X-Auth-Token': apiKey }
        }).catch(err => {
          console.error("Failed to fetch football-data.org in match-results:", err.message);
          return { ok: false };
        }),
        fetch('https://worldcup26.ir/get/games', {
          headers: {
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }).catch(err => {
          console.error("Failed to fetch worldcup26.ir in match-results:", err.message);
          return { ok: false };
        })
      ]);

      let dbMatches = [];
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        const rawData = dbData.data || [];
        dbMatches = Array.isArray(rawData) ? rawData : [rawData];
      } else {
        throw new Error(`Directus matches lookup failed: ${dbRes.statusText}`);
      }

      let externalMatches = [];
      if (apiRes.ok) {
        try {
          const data = await apiRes.json();
          externalMatches = data.matches || [];
        } catch (e) {
          console.error("Failed to parse football-data matches:", e.message);
        }
      }

      let wcGames = [];
      if (wcRes.ok) {
        try {
          const wcData = await wcRes.json();
          wcGames = wcData.games || [];
        } catch (e) {
          console.error("Failed to parse worldcup26 games:", e.message);
        }
      }

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

        if (!fdMatch) continue;

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

        results.push({
          id: dbMatch.id,
          teams: `${dbMatch.team_a} vs ${dbMatch.team_b}`,
          current_status: newStatus,
          success: directusResponseOk
        });
      }

      try {
        knockoutUpdates = await autoAdvanceKnockoutStages(directusUrl, adminToken);
      } catch (advanceErr) {
        console.error("Failed to advance knockout matches automatically:", advanceErr.message);
      }

      // Recalculate rankings based on parameters
      if (shouldSyncAndCalcAll) {
        calculationLogs = await recalculateRankings(directusUrl, adminToken, null, loggedInUser, true);
      } else if (targetUser || shouldCalcAll) {
        calculationLogs = await recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, true);
      }
    } else {
      // Standard recalculation logic path without matching sync
      calculationLogs = await recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride);
    }
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }

  let finalMsg = 'Recalculation processed successfully.';
  if (shouldSyncAndCalcAll) {
    finalMsg = 'All matches synced and recalculation complete.';
  } else if (shouldSyncMatches) {
    finalMsg = 'Matches synchronization processed successfully.';
  }

  return response.status(200).json({
    success: true,
    message: finalMsg,
    updates: results,
    knockoutUpdates: knockoutUpdates,
    calculationLogs: calculationLogs
  });
}

export async function autoAdvanceKnockoutStages(directusUrl, adminToken) {
  const headers = { 'Authorization': `Bearer ${adminToken}` };
  const updates = [];
  
  // 1. Fetch all matches
  const matchesRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
  if (!matchesRes.ok) return updates;
  const matchesData = await matchesRes.json();
  const allMatches = matchesData.data || [];

  // Group Stage matches
  const groupMatches = allMatches.filter(m => m.phase === 'Group Stage');
  const knockoutMatches = allMatches.filter(m => m.phase !== 'Group Stage');

  if (allMatches.length === 0) return updates;

  // ----------------------------------------------------
  // PART A: AUTO-ADVANCE GROUP WINNERS & RUNNERS-UP TO ROUND OF 32
  // ----------------------------------------------------
  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L'];
  
  for (const groupName of groups) {
    const matchesInGroup = groupMatches.filter(m => m.group === groupName);
    const playedInGroup = matchesInGroup.filter(m => m.fulltime_a !== null && m.fulltime_b !== null);

    // Safeguard: Need more than 2 matches played in the group to determine standing stability
    if (playedInGroup.length <= 2) continue;

    const standings = {};
    for (const m of matchesInGroup) {
      if (!standings[m.team_a]) standings[m.team_a] = { team: m.team_a, points: 0, gd: 0, played: 0 };
      if (!standings[m.team_b]) standings[m.team_b] = { team: m.team_b, points: 0, gd: 0, played: 0 };

      if (m.fulltime_a !== null && m.fulltime_b !== null) {
        standings[m.team_a].played += 1;
        standings[m.team_b].played += 1;
        const scoreA = Number(m.fulltime_a);
        const scoreB = Number(m.fulltime_b);
        standings[m.team_a].gd += (scoreA - scoreB);
        standings[m.team_b].gd += (scoreB - scoreA);

        if (scoreA > scoreB) {
          standings[m.team_a].points += 3;
        } else if (scoreA < scoreB) {
          standings[m.team_b].points += 3;
        } else {
          standings[m.team_a].points += 1;
          standings[m.team_b].points += 1;
        }
      }
    }

    const teamList = Object.values(standings).sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
    if (teamList.length < 2) continue;

    const first = teamList[0];
    const second = teamList[1];
    const third = teamList[2];

    let winner = null;
    let runnerUp = null;

    const isGroupFinished = (playedInGroup.length === matchesInGroup.length);
    if (isGroupFinished) {
      winner = first.team;
      runnerUp = second.team;
    } else {
      if (third && first.points - third.points > 3) {
        winner = first.team;
      }
      if (third && second.points - third.points > 3) {
        runnerUp = second.team;
      }
    }

    const groupLetter = groupName.split(' ')[1]; // A, B, C...

    for (const r32 of knockoutMatches) {
      let updatedPayload = null;

      if (winner) {
        const placeholder = `Group ${groupLetter} Winner`;
        if (r32.team_a === placeholder) {
          updatedPayload = { team_a: winner };
        } else if (r32.team_b === placeholder) {
          updatedPayload = { team_b: winner };
        }
      }

      if (runnerUp) {
        const placeholder = `Group ${groupLetter} Runner-up`;
        if (r32.team_a === placeholder) {
          updatedPayload = { team_a: runnerUp };
        } else if (r32.team_b === placeholder) {
          updatedPayload = { team_b: runnerUp };
        }
      }

      if (updatedPayload) {
        const directusResponse = await fetch(`${directusUrl}/items/matches/${r32.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(updatedPayload)
        });
        if (directusResponse.ok) {
          // Reflect update in local copy to allow cascading checks below
          if (updatedPayload.team_a) r32.team_a = updatedPayload.team_a;
          if (updatedPayload.team_b) r32.team_b = updatedPayload.team_b;
          updates.push({
            id: r32.id,
            placeholder: winner ? `Group ${groupLetter} Winner` : `Group ${groupLetter} Runner-up`,
            advancedTeam: winner || runnerUp,
            success: true
          });
        }
      }
    }
  }

  // ----------------------------------------------------
  // PART B: AUTO-ADVANCE LATER STAGES (Winner Match X / Runner-up Match X)
  // ----------------------------------------------------
  // Iterate multiple passes to allow cascading advancement (e.g. R32 winner advances to R16, R16 winner to QF, etc.)
  let changedInPass = true;
  let passCount = 0;
  
  while (changedInPass && passCount < 5) {
    changedInPass = false;
    passCount++;

    for (const match of knockoutMatches) {
      const winnerPlaceholderA = match.team_a && match.team_a.startsWith('Winner Match ');
      const runnerUpPlaceholderA = match.team_a && match.team_a.startsWith('Runner-up Match ');
      const winnerPlaceholderB = match.team_b && match.team_b.startsWith('Winner Match ');
      const runnerUpPlaceholderB = match.team_b && match.team_b.startsWith('Runner-up Match ');

      let updatedPayload = null;

      // Handle Team A placeholder resolution
      if (winnerPlaceholderA) {
        const refMatchId = match.team_a.split('Winner Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (refMatch && refMatch.fulltime_a !== null && refMatch.fulltime_b !== null) {
          const winner = Number(refMatch.fulltime_a) > Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_a: winner };
        }
      } else if (runnerUpPlaceholderA) {
        const refMatchId = match.team_a.split('Runner-up Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (refMatch && refMatch.fulltime_a !== null && refMatch.fulltime_b !== null) {
          const runnerUp = Number(refMatch.fulltime_a) < Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_a: runnerUp };
        }
      }

      // Handle Team B placeholder resolution
      if (winnerPlaceholderB) {
        const refMatchId = match.team_b.split('Winner Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (refMatch && refMatch.fulltime_a !== null && refMatch.fulltime_b !== null) {
          const winner = Number(refMatch.fulltime_a) > Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_b: winner };
        }
      } else if (runnerUpPlaceholderB) {
        const refMatchId = match.team_b.split('Runner-up Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (refMatch && refMatch.fulltime_a !== null && refMatch.fulltime_b !== null) {
          const runnerUp = Number(refMatch.fulltime_a) < Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_b: runnerUp };
        }
      }

      if (updatedPayload) {
        const directusResponse = await fetch(`${directusUrl}/items/matches/${match.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(updatedPayload)
        });

        if (directusResponse.ok) {
          if (updatedPayload.team_a) match.team_a = updatedPayload.team_a;
          if (updatedPayload.team_b) match.team_b = updatedPayload.team_b;
          changedInPass = true;
          
          updates.push({
            id: match.id,
            team_a_updated: !!updatedPayload.team_a,
            team_b_updated: !!updatedPayload.team_b,
            success: true
          });
        }
      }
    }
  }

  return updates;
}


export async function recalculateRankings(directusUrl, adminToken, specificUser = null, loggedInUser = null, isExplicitOverride = false) {
  const apiLogs = [];
  try {
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    const pronoFilter = specificUser ? `&filter[user][eq]=${specificUser}` : "";
    
    const [matchesRes, predictionsRes, rankingsRes] = await Promise.all([
      fetch(`${directusUrl}/items/matches?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/pronostiques?limit=-1${pronoFilter}`, { headers }),
      fetch(`${directusUrl}/items/pronostics_rankings?limit=-1`, { headers })
    ]);
    
    const [matchesData, predictionsData, rankingsData] = await Promise.all([
      matchesRes.json(),
      predictionsRes.json(),
      rankingsRes.json()
    ]);
    
    const matches = matchesData.data || [];
    const predictions = predictionsData.data || [];
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

    if (specificUser) {
      const dynamicRankings = [...existingRankings];
      const calculatedUser = rankingObj.find(u => u.key === specificUser);

      if (calculatedUser) {
        const matchingIndex = dynamicRankings.findIndex(r => r.key === specificUser);
        if (matchingIndex !== -1) {
          dynamicRankings[matchingIndex].point = calculatedUser.point;
        } else {
          dynamicRankings.push({ key: specificUser, point: calculatedUser.point });
        }
      }

      dynamicRankings.sort((a, b) => b.point - a.point);
      let runningRank = 1;
      dynamicRankings.forEach((obj, idx) => {
        if (idx > 0 && obj.point !== dynamicRankings[idx - 1].point) {
          runningRank = idx + 1;
        }
        if (obj.key === specificUser && calculatedUser) {
          calculatedUser.rank = runningRank;
        }
      });
    } else {
      rankingObj.sort((a, b) => b.point - a.point || a.key.localeCompare(b.key));
      let rank = 1;
      rankingObj.forEach((obj, index) => {
        if (index > 0 && obj.point !== rankingObj[index - 1].point) {
          rank = index + 1;
        }
        obj.rank = rank;
      });
    }

    for (const player of rankingObj) {
      // If specificUser is set, only update this user. Otherwise, update everyone if isExplicitOverride is true or we are doing a general sync (no loggedInUser).
      const isTargetedUser = specificUser !== null ? (player.key === specificUser) : true;
      const shouldSaveToDb = isExplicitOverride ? isTargetedUser : (!loggedInUser || player.key === loggedInUser);

      if (!shouldSaveToDb) continue;

      const rankingRow = {
        key: player.key,
        point: player.point,
        rank: player.rank,
        status: 'published'
      };

      const existingRow = existingRankings.find(item => item.key === player.key);

      if (existingRow) {
        if (Number(existingRow.point) === Number(rankingRow.point) && Number(existingRow.rank) === Number(rankingRow.rank)) {
          // Point and rank are unchanged. Skip patching!
          continue;
        }
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