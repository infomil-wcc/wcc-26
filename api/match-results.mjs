import { handleCors, fetchWithBypass } from '../backend/libs/utils.mjs';
import { syncMatchesPipeline } from '../backend/libs/match-core.mjs';
import { calcResultForRanking } from '../backend/libs/match-calculations.mjs';
import { calcBracketPoints } from '../backend/libs/calc-bracket-stage.mjs';
export { hasMatchChanged } from '../backend/libs/match-calculations.mjs';

// Proxy internal exports to maintain external backwards compatibility
export { getNormalizedTeamName, getNormalizedPhase, getDbMatchUtcTime, getFdMatchUtcTime, getWcGameApproxUtcTime, parseScorersString } from '../backend/libs/match-mappings.mjs';

// ==========================================
// FACTORY FUNCTION FOR ROUTE HANDLER (DI)
// ==========================================
export function createHandler(deps = {}) {
  // Injectable dependencies with standard production fallbacks
  const fetch = deps.fetch || fetchWithBypass;
  const env = deps.env || process.env;
  const _syncMatchesPipeline = deps.syncMatchesPipeline || syncMatchesPipeline;
  const _autoAdvanceKnockoutStages = deps.autoAdvanceKnockoutStages || autoAdvanceKnockoutStages;
  const _recalculateRankings = deps.recalculateRankings || recalculateRankings;

  return async function handler(request, response) {
    if (handleCors(request, response)) return;

    if (request.method !== 'POST' && request.method !== 'GET') {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const directusUrl = env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = env.DIRECTUS_ADMIN_TOKEN;
    const apiKey = env.FOOTBALL_DATA_API_KEY;

    const queryData = request.query || {};
    const matchesParam = queryData.matches ? queryData.matches.replace(/['"]/g, '').trim() : null;
    const pointsParam = queryData.points ? queryData.points.replace(/['"]/g, '').trim() : null;

    const shouldSyncAndCalcAll = (matchesParam === 'all' && pointsParam === 'all');
    const shouldCalcAll = (pointsParam === 'all' && matchesParam !== 'all');
    const shouldSyncMatches = matchesParam !== null && !shouldSyncAndCalcAll;
    const syncMatchId = (matchesParam && matchesParam !== 'all') ? parseInt(matchesParam, 10) : null;

    const isExplicitOverride = matchesParam !== null || pointsParam !== null;

    const headersData = request.headers || {};
    const authHeader = headersData.authorization || '';
    let loggedInUser = headersData['x-user-id'] || headersData['x-authenticated-user'] || null;

    if (!isExplicitOverride && !loggedInUser && !authHeader) {
      return response.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No user session detected and no override parameter passed."
      });
    }

    if (!apiKey) {
      return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
    }

    let syncResults = [];
    let calculationLogs = [];
    let knockoutUpdates = [];

    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };

      if (shouldSyncAndCalcAll || shouldSyncMatches) {
        const dbUrl = syncMatchId ? `${directusUrl}/items/matches/${syncMatchId}` : `${directusUrl}/items/matches?limit=-1`;
        const dbRes = await fetch(dbUrl, { headers });

        let dbMatches = [];
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          dbMatches = Array.isArray(dbData.data) ? dbData.data : [dbData.data].filter(Boolean);
        } else {
          throw new Error(`Directus matches lookup failed: ${dbRes.statusText}`);
        }

        // Forward injected fetch context downward
        const pipeline = await _syncMatchesPipeline(dbMatches, { directusUrl, adminToken, apiKey }, { fetch });
        syncResults = pipeline.updates;

        try {
          knockoutUpdates = await _autoAdvanceKnockoutStages(directusUrl, adminToken, { fetch });
        } catch (advanceErr) {
          console.error("Failed to advance knockout matches automatically:", advanceErr.message);
        }

        let targetUser = (pointsParam && pointsParam !== 'all') ? pointsParam : null;
        if (shouldSyncAndCalcAll) {
          calculationLogs = await _recalculateRankings(directusUrl, adminToken, null, loggedInUser, true, { fetch });
        } else if (targetUser || shouldCalcAll) {
          calculationLogs = await _recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, true, { fetch });
        }
      } else {
        let targetUser = (pointsParam && pointsParam !== 'all') ? pointsParam : null;
        calculationLogs = await _recalculateRankings(directusUrl, adminToken, targetUser, loggedInUser, isExplicitOverride, { fetch });
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
      updates: syncResults,
      knockoutUpdates,
      calculationLogs
    });
  };
}

// Initialize a default instance for production runtime and export it
const defaultHandler = createHandler();
export default defaultHandler;

function isPlaceholder(teamName) {
  if (!teamName) return true;
  const name = teamName.toLowerCase().trim();
  return name.includes('winner') || name.includes('runner-up') || name.includes('play-off') || name.includes('à déterminer');
}

// ==========================================
// KNOCKOUT CASCADING STAGE ADVANCEMENTS
// ==========================================
export async function autoAdvanceKnockoutStages(directusUrl, adminToken, deps = {}) {
  const fetch = deps.fetch || fetchWithBypass;
  const headers = { 'Authorization': `Bearer ${adminToken}` };
  const updates = [];

  const matchesRes = await fetch(`${directusUrl}/items/matches?limit=-1`, { headers });
  if (!matchesRes.ok) return updates;
  const matchesData = await matchesRes.json();
  const allMatches = matchesData.data || [];

  const groupMatches = allMatches.filter(m => m.phase === 'Group Stage');
  const knockoutMatches = allMatches.filter(m => m.phase !== 'Group Stage');

  if (allMatches.length === 0) return updates;

  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L'];

  for (const groupName of groups) {
    const matchesInGroup = groupMatches.filter(m => m.group === groupName);
    const playedInGroup = matchesInGroup.filter(m => m.fulltime_a !== null && m.fulltime_b !== null);

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

        if (scoreA > scoreB) standings[m.team_a].points += 3;
        else if (scoreA < scoreB) standings[m.team_b].points += 3;
        else {
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

    if (playedInGroup.length === matchesInGroup.length) {
      winner = first.team;
      runnerUp = second.team;
    } else {
      if (third && first.points - third.points > 3) winner = first.team;
      if (third && second.points - third.points > 3) runnerUp = second.team;
    }

    const groupLetter = groupName.split(' ')[1];

    for (const r32 of knockoutMatches) {
      let updatedPayload = null;

      if (winner) {
        const placeholder = `Group ${groupLetter} Winner`;
        if (r32.team_a === placeholder) updatedPayload = { team_a: winner };
        else if (r32.team_b === placeholder) updatedPayload = { team_b: winner };
      }

      if (runnerUp) {
        const placeholder = `Group ${groupLetter} Runner-up`;
        if (r32.team_a === placeholder) updatedPayload = { team_a: runnerUp };
        else if (r32.team_b === placeholder) updatedPayload = { team_b: runnerUp };
      }

      if (updatedPayload) {
        const finalTeamA = updatedPayload.team_a || r32.team_a;
        const finalTeamB = updatedPayload.team_b || r32.team_b;
        if (!isPlaceholder(finalTeamA) && !isPlaceholder(finalTeamB) && r32.status === 'draft') {
          updatedPayload.status = 'published';
        }

        const directusResponse = await fetch(`${directusUrl}/items/matches/${r32.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(updatedPayload)
        });
        if (directusResponse.ok) {
          if (updatedPayload.team_a) r32.team_a = updatedPayload.team_a;
          if (updatedPayload.team_b) r32.team_b = updatedPayload.team_b;
          if (updatedPayload.status) r32.status = updatedPayload.status;
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
        const finalTeamA = updatedPayload.team_a || match.team_a;
        const finalTeamB = updatedPayload.team_b || match.team_b;
        if (!isPlaceholder(finalTeamA) && !isPlaceholder(finalTeamB) && match.status === 'draft') {
          updatedPayload.status = 'published';
        }

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
          if (updatedPayload.status) match.status = updatedPayload.status;
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

// ==========================================
// USER LEADERBOARD RANKING CALCULATIONS
// ==========================================
export async function recalculateRankings(directusUrl, adminToken, specificUser = null, loggedInUser = null, isExplicitOverride = false, deps = {}) {
  const fetch = deps.fetch || fetchWithBypass;
  const apiLogs = [];
  try {
    const headers = { 'Authorization': `Bearer ${adminToken}` };
    const pronoFilter = specificUser ? `&filter[user][eq]=${specificUser}` : "";

    const [matchesRes, predictionsRes, rankingsRes, rulesRes, bracketResultsRes, bracketsRes, knockoutBracketsRes, bracketRankingsRes] = await Promise.all([
      fetch(`${directusUrl}/items/matches?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/pronostiques?limit=-1${pronoFilter}`, { headers }),
      fetch(`${directusUrl}/items/pronostics_rankings?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/game_scoring_rules?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/bracket_result?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/bracket?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/bracket_knockout?limit=-1`, { headers }),
      fetch(`${directusUrl}/items/bracket_rankings?limit=-1`, { headers })
    ]);

    const matchesData = matchesRes.ok ? await matchesRes.json() : {};
    const predictionsData = predictionsRes.ok ? await predictionsRes.json() : {};
    const rankingsData = rankingsRes.ok ? await rankingsRes.json() : {};
    const rulesData = rulesRes.ok ? await rulesRes.json() : {};

    const matches = matchesData.data || [];
    const predictions = predictionsData.data || [];
    const existingRankings = rankingsData.data || [];
    const ruleMatrix = rulesData.data || [];

    let bracketResults = [];
    if (bracketResultsRes && typeof bracketResultsRes.json === 'function') {
      try {
        const d = await bracketResultsRes.json();
        bracketResults = d.data || [];
      } catch (e) { }
    }

    let brackets = [];
    if (bracketsRes && typeof bracketsRes.json === 'function') {
      try {
        const d = await bracketsRes.json();
        brackets = d.data || [];
      } catch (e) { }
    }

    let knockoutBrackets = [];
    if (knockoutBracketsRes && typeof knockoutBracketsRes.json === 'function') {
      try {
        const d = await knockoutBracketsRes.json();
        knockoutBrackets = d.data || [];
      } catch (e) { }
    }

    let existingBracketRankings = [];
    if (bracketRankingsRes && typeof bracketRankingsRes.json === 'function') {
      try {
        const d = await bracketRankingsRes.json();
        existingBracketRankings = d.data || [];
      } catch (e) { }
    }

    // Sync match point fields with the rules matrix (mapping 'Third Place' to 'Final')
    for (const game of matches) {
      const targetPhase = game.phase === 'Third Place' ? 'Final' : game.phase;
      const rule = ruleMatrix.find(r => r.game_type === 'pronostics' && r.phase === targetPhase);
      if (rule) {
        const expectedWinnerPoint = Number(rule.winner_draw_points) || 0;
        const expectedFulltimePoint = Number(rule.fulltime_exact_points) || 0;
        const expectedHalftimePoint = Number(rule.halftime_exact_points) || 0;
        const expectedScorerPoint = Number(rule.scorer_points) || 0;

        if (
          game.winner_point !== expectedWinnerPoint ||
          game.fulltime_point !== expectedFulltimePoint ||
          game.halftime_point !== expectedHalftimePoint ||
          game.scorer_point !== expectedScorerPoint
        ) {
          await fetch(`${directusUrl}/items/matches/${game.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              winner_point: expectedWinnerPoint,
              fulltime_point: expectedFulltimePoint,
              halftime_point: expectedHalftimePoint,
              scorer_point: expectedScorerPoint
            })
          });

          game.winner_point = expectedWinnerPoint;
          game.fulltime_point = expectedFulltimePoint;
          game.halftime_point = expectedHalftimePoint;
          game.scorer_point = expectedScorerPoint;

          apiLogs.push(`Synced points in Directus for Match ID: ${game.id} (${game.phase})`);
        }
      }
    }

    const playedMatches = matches.filter(m => m.fulltime_a !== null && m.fulltime_b !== null);

    const userPredictions = {};
    for (const prono of predictions) {
      if (!prono.user) continue;
      if (!userPredictions[prono.user]) userPredictions[prono.user] = [];
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
          const pts = calcResultForRanking(game, prono, ruleMatrix);
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
        if (matchingIndex !== -1) dynamicRankings[matchingIndex].point = calculatedUser.point;
        else dynamicRankings.push({ key: specificUser, point: calculatedUser.point });
      }

      dynamicRankings.sort((a, b) => b.point - a.point);
      let runningRank = 1;
      dynamicRankings.forEach((obj, idx) => {
        if (idx > 0 && obj.point !== dynamicRankings[idx - 1].point) runningRank = idx + 1;
        if (obj.key === specificUser && calculatedUser) calculatedUser.rank = runningRank;
      });
    } else {
      rankingObj.sort((a, b) => b.point - a.point || a.key.localeCompare(b.key));
      let rank = 1;
      rankingObj.forEach((obj, index) => {
        if (index > 0 && obj.point !== rankingObj[index - 1].point) rank = index + 1;
        obj.rank = rank;
      });
    }

    for (const player of rankingObj) {
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

    // Recalculate bracket rankings
    if (bracketResults.length > 0 && brackets.length > 0) {
      const bracketResult = bracketResults[0];
      const ruleMatrixBracket = ruleMatrix.filter(r => r.game_type === 'bracket');

      const bracketMatchesToEvaluate = [
        ...Array.from({ length: 16 }, (_, i) => ({ key: `winner_r32_${i + 1}`, phase: 'Round of 32' })),
        ...Array.from({ length: 8 }, (_, i) => ({ key: `winner_r16_${i + 1}`, phase: 'Round of 16' })),
        ...Array.from({ length: 4 }, (_, i) => ({ key: `winner_r4_${i + 1}`, phase: 'Quarter-finals' })),
        { key: 'winner_wc', phase: 'Final', isGrandFinal: true }
      ];

      const ruleSemi = ruleMatrixBracket.find(r => r.phase.trim().toLowerCase() === 'semi-finals');
      const bonusFinalist = ruleSemi ? Number(ruleSemi.qualification_bonus_points ?? 0) : 75;

      const actualFinalists = [
        bracketResult.winner_semi_1,
        bracketResult.winner_semi_2
      ].filter(team => team && team !== 'À déterminer');

      const userBracketsMap = new Map();
      for (const b of brackets) {
        if (b.user) userBracketsMap.set(b.user.toLowerCase().trim(), b);
      }
      for (const kb of knockoutBrackets) {
        if (kb.user) userBracketsMap.set(kb.user.toLowerCase().trim(), kb);
      }
      const activeBrackets = Array.from(userBracketsMap.values());

      const bracketRankingObj = [];
      for (const b of activeBrackets) {
        let point = 0;
        const pSource = (b.predictions_json && typeof b.predictions_json === 'object') ? { ...b, ...b.predictions_json } : b;

        for (const match of bracketMatchesToEvaluate) {
          const prediction = pSource[match.key];
          const actual = bracketResult[match.key];

          const item = {
            predicted_winner: prediction,
            predicted_finalist: match.phase === 'Semi-finals' ? prediction : null,
            predicted_champion: match.isGrandFinal ? prediction : null,
            is_grand_final: match.isGrandFinal || false
          };

          point += calcBracketPoints(item, actual, match.phase, ruleMatrixBracket);
        }

        // Swapped finalist support matching frontend logic
        const predFinalists = [
          pSource.winner_semi_1,
          pSource.winner_semi_2
        ].filter(team => team && team !== 'À déterminer');

        predFinalists.forEach(predTeam => {
          if (actualFinalists.includes(predTeam)) {
            point += bonusFinalist;
          }
        });

        bracketRankingObj.push({
          user: b.user,
          point: point
        });
      }

      // Sort bracket rankings: point descending, then user ascending
      bracketRankingObj.sort((a, b) => {
        if (b.point !== a.point) return b.point - a.point;
        return (a.user || '').localeCompare(b.user || '');
      });

      // Add rank
      let rank = 1;
      bracketRankingObj.forEach((obj, index) => {
        if (index > 0 && obj.point !== bracketRankingObj[index - 1].point) {
          rank = index + 1;
        }
        obj.rank = rank;
        obj.status = 'published';
      });

      const rankingData = {
        status: 'published',
        ranking_json: bracketRankingObj
      };

      if (existingBracketRankings.length > 0) {
        const existingRow = existingBracketRankings[0];
        if (JSON.stringify(existingRow.ranking_json) !== JSON.stringify(bracketRankingObj)) {
          await fetch(`${directusUrl}/items/bracket_rankings/${existingRow.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(rankingData)
          });
          apiLogs.push(`Updated bracket rankings (ID: ${existingRow.id})`);
        }
      } else {
        await fetch(`${directusUrl}/items/bracket_rankings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(rankingData)
        });
        apiLogs.push(`Created new bracket rankings`);
      }
    }

    return apiLogs;
  } catch (err) {
    console.error("Error during ranking recalculation:", err);
    throw err;
  }
}