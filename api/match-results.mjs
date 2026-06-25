import { handleCors } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

// --- TOURNAMENT PHASE MAPPING ---
const phaseMap = {
  "group": "Group Stage",
  "group_stage": "Group Stage",
  "r32": "Round of 32",
  "last_32": "Round of 32",
  "r16": "Round of 16",
  "last_16": "Round of 16",
  "qf": "Quarter-finals",
  "quarter_finals": "Quarter-finals",
  "sf": "Semi-finals",
  "semi_finals": "Semi-finals",
  "third": "Third Place",
  "third_place": "Third Place",
  "final": "Final"
};

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
  let targetUser = queryData.points ? queryData.points.replace(/['"]/g, '').trim() : null;
  const isExplicitOverride = targetUser !== null; 
  const shouldCalcAll = queryData.calc === '1' || targetUser === 'all';

  if (targetUser === 'all') {
    targetUser = null; 
  }

  // FIXED: Bulletproof fallback headers wrapper object to stop Vercel Invocation crashes
  const headersData = request.headers || {};
  const authHeader = headersData.authorization || '';
  let loggedInUser = headersData['x-user-id'] || headersData['x-authenticated-user'] || null;

  // Enforce session check ONLY if no explicit override query is running
  if (!isExplicitOverride && !shouldCalcAll) {
    if (!loggedInUser && !authHeader) {
      return response.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No user session detected and no override parameter passed."
      });
    }
  }

  if (shouldCalcAll || targetUser || isExplicitOverride) {
    try {
      const debugLogs = await recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride);
      return response.status(200).json({
        success: true,
        message: `Recalculation processed successfully.`,
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
  // --------------------------------------------------

  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  // Keep it active solely for recalculation triggers and queries
  const nowIso = new Date().toISOString();
  const results = [];
  let calculationLogs = [];

  try {
    // If a request needs recalculation, it's done directly
    calculationLogs = await recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }

  return response.status(200).json({
    success: true,
    message: `Recalculation processed successfully.`,
    updates: results,
    calculationLogs: calculationLogs
  });
}

export async function recalculateRankings(directusUrl, adminToken, specificUser = null, loggedInUser = null, isExplicitOverride = false) {
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