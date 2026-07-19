import { fetchWithBypass, parseMauritianDate } from './utils.mjs';
import { calcResultForRanking } from './match-calculations.mjs';
import { calcBracketPoints } from './calc-bracket-stage.mjs';

/**
 * USER LEADERBOARD RANKING CALCULATIONS
 * Validates timestamps to eliminate post-kickoff submissions or modifications.
 */
export async function recalculateRankings(directusUrl, adminToken, specificUser = null, loggedInUser = null, isExplicitOverride = false, deps = {}, batchOffset = 0, batchSize = null, forceUpdate = false) {
  const fetch = deps.fetch || fetchWithBypass;
  const apiLogs = [];
  try {
    const headers = { 'Authorization': `Bearer ${adminToken}` };
    const pronoFilter = specificUser ? `&filter[user][_eq]=${specificUser}` : "";

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
      try { const d = await bracketResultsRes.json(); bracketResults = d.data || []; } catch (e) { }
    }

    let brackets = [];
    if (bracketsRes && typeof bracketsRes.json === 'function') {
      try { const d = await bracketsRes.json(); brackets = d.data || []; } catch (e) { }
    }

    let knockoutBrackets = [];
    if (knockoutBracketsRes && typeof knockoutBracketsRes.json === 'function') {
      try { const d = await knockoutBracketsRes.json(); knockoutBrackets = d.data || []; } catch (e) { }
    }

    let existingBracketRankings = [];
    if (bracketRankingsRes && typeof bracketRankingsRes.json === 'function') {
      try { const d = await bracketRankingsRes.json(); existingBracketRankings = d.data || []; } catch (e) { }
    }

    // Sync match point fields with rules matrix — only on the FIRST batch to avoid redundant PATCH calls
    if (batchOffset === 0) {
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
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
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
        scorer: prono.scorer,
        breakdown: { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false }
      }));

      // Sort by created_on DESCENDING to ensure we take the newest valid occurrence of multiple records
      userPredictions[username].sort((a, b) => {
        const dateA = a.created_on ? new Date(a.created_on).getTime() : 0;
        const dateB = b.created_on ? new Date(b.created_on).getTime() : 0;
        return dateB - dateA;
      });

      const processedGames = new Set();

      for (const prono of userPredictions[username]) {
        const gameIdStr = String(prono.game_id);

        const game = playedMatches.find(m => String(m.id) === gameIdStr);
        if (game) {
          // 🚨 TIMESTAMP FRAUD CHECK
          const predictionCreated = prono.created_on ? parseMauritianDate(prono.created_on) : null;
          const predictionModified = prono.modified_on ? parseMauritianDate(prono.modified_on) : null;
          const matchKickoff = parseMauritianDate(game.date);

          let isInvalidated = false;
          if (predictionCreated && predictionCreated > matchKickoff) isInvalidated = true;
          if (predictionModified && predictionModified > matchKickoff) isInvalidated = true;

          let isDuplicate = false;
          if (processedGames.has(gameIdStr)) {
            isDuplicate = true;
          } else if (!isInvalidated && prono.fulltime_a !== null && prono.fulltime_a !== "") {
            processedGames.add(gameIdStr);
          }

          let pts = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
          if (isDuplicate) {
            // Already processed this game, give 0 points to duplicates
            pts.isFraud = true;
            apiLogs.push(`⚠️ DUPLICATE DETECTED | User: ${username} | Match ID: ${game.id} | Points forced to 0 for duplicate record.`);
          } else if (isInvalidated) {
            pts.isFraud = true;
            apiLogs.push(`⚠️ FRAUD DETECTED | User: ${username} | Match ID: ${game.id} submitted or edited late! Points forced to 0.`);
          } else {
            pts = calcResultForRanking(game, prono, ruleMatrix);
            totalPoints += pts.total;
            apiLogs.push(`User: ${username} | Match ID: ${game.id} | Earned: ${pts.total} pts`);
          }
          const userPronoIndex = userPronos.findIndex(p => p.id === prono.id);
          if (userPronoIndex > -1) {
            userPronos[userPronoIndex].breakdown = pts;
          }
        }
      }

      rankingObj.push({
        key: username,
        point: totalPoints,
        pronostiques: userPronos
      });
    }

    // ── Merge in other existing rankings for full ranking recalculation ──
    for (const ext of existingRankings) {
      const alreadyAdded = rankingObj.some(u => u.key.toLowerCase() === ext.key.toLowerCase());
      if (!alreadyAdded) {
        rankingObj.push({
          key: ext.key,
          point: Number(ext.point) || 0,
          pronostiques: ext.pronostiques || [],
          rank: Number(ext.rank) || 999
        });
      }
    }

    // Sort and calculate ranks for ALL users in rankingObj
    rankingObj.sort((a, b) => b.point - a.point || a.key.localeCompare(b.key));
    let rank = 1;
    rankingObj.forEach((obj, index) => {
      if (index > 0 && obj.point !== rankingObj[index - 1].point) rank = index + 1;
      obj.rank = rank;
    });

    // ── Batch write logic ──
    const totalUsers = rankingObj.length;
    let batchSlice = [];
    let nextOffset = batchOffset;
    let isDone = true;

    if (specificUser !== null) {
      batchSlice = rankingObj;
      isDone = true;
    } else {
      const effectiveBatchSize = batchSize !== null ? batchSize : totalUsers;
      batchSlice = rankingObj.slice(batchOffset, batchOffset + effectiveBatchSize);
      nextOffset = batchOffset + effectiveBatchSize;
      isDone = nextOffset >= totalUsers;
    }

    for (const player of batchSlice) {
      const isTargetedUser = specificUser !== null ? (player.key.toLowerCase() === specificUser.toLowerCase()) : true;
      const existingRow = existingRankings.find(item => item.key.toLowerCase() === player.key.toLowerCase());

      let rankChanged = false;
      if (existingRow && Number(existingRow.rank) !== Number(player.rank)) {
        rankChanged = true;
      }

      const shouldSaveToDb = isExplicitOverride
        ? (isTargetedUser || rankChanged)
        : (!loggedInUser || player.key === loggedInUser);

      if (!shouldSaveToDb) continue;

      if (isTargetedUser) {
        apiLogs.push(`[DEBUG] Recalculating ${player.key} | Calculated Points: ${player.point} | DB Points: ${existingRow ? existingRow.point : 'N/A'} | ForceUpdate: ${forceUpdate}`);
      }

      const rankingRow = {
        key: player.key,
        point: player.point,
        rank: player.rank,
        status: 'published',
        pronostiques: player.pronostiques
      };

      if (existingRow) {
        if (!forceUpdate && Number(existingRow.point) === Number(rankingRow.point) && Number(existingRow.rank) === Number(rankingRow.rank) && JSON.stringify(existingRow.pronostiques) === JSON.stringify(rankingRow.pronostiques)) {
          continue;
        }
        const patchRes = await fetch(`${directusUrl}/items/pronostics_rankings/${existingRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify(rankingRow)
        });
        if (!patchRes.ok) {
          const errText = await patchRes.text();
          apiLogs.push(`❌ Directus PATCH failed for ${player.key}: Status ${patchRes.status} - ${errText}`);
        } else {
          apiLogs.push(`✅ PATCH success for ${player.key}. Old points: ${existingRow.point}, New points: ${player.point}`);
        }
      } else {
        await fetch(`${directusUrl}/items/pronostics_rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify(rankingRow)
        });
      }
      apiLogs.push(`Saved row in Directus for user: ${player.key}`);
    }

    // ── Cleanup stale records — only on the last batch ───────────────────────
    if (isDone && isExplicitOverride && specificUser === null) {
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

    // didier: deactivate recalculate bracket rankings
    if (false && bracketResults.length > 0 && brackets.length > 0) {
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

      const actualFinalists = [bracketResult.winner_semi_1, bracketResult.winner_semi_2].filter(team => team && team !== 'À déterminer');

      const userBracketsMap = new Map();
      for (const b of brackets) if (b.user) userBracketsMap.set(b.user.toLowerCase().trim(), b);
      for (const kb of knockoutBrackets) if (kb.user) userBracketsMap.set(kb.user.toLowerCase().trim(), kb);
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

        const predFinalists = [pSource.winner_semi_1, pSource.winner_semi_2].filter(team => team && team !== 'À déterminer');
        predFinalists.forEach(predTeam => {
          if (actualFinalists.includes(predTeam)) point += bonusFinalist;
        });

        bracketRankingObj.push({ user: b.user, point: point, ranking_json: pSource, phase: "1" });
      }

      bracketRankingObj.sort((a, b) => (b.point - a.point) || (a.user || '').localeCompare(b.user || ''));

      let rank = 1;
      bracketRankingObj.forEach((obj, index) => {
        if (index > 0 && obj.point !== bracketRankingObj[index - 1].point) rank = index + 1;
        obj.rank = rank;
        obj.status = 'published';
      });

      for (const rankObj of bracketRankingObj) {
        const rankingData = {
          status: 'published',
          user: rankObj.user,
          phase: rankObj.phase,
          point: rankObj.point,
          rank: rankObj.rank,
          ranking_json: rankObj.ranking_json
        };

        const existingRow = existingBracketRankings.find(item => item.user === rankObj.user && item.phase === rankObj.phase);

        if (existingRow) {
          if (JSON.stringify(existingRow.ranking_json) !== JSON.stringify(rankObj.ranking_json) || existingRow.point !== rankObj.point || existingRow.rank !== rankObj.rank) {
            await fetch(`${directusUrl}/items/bracket_rankings/${existingRow.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
              body: JSON.stringify(rankingData)
            });
            apiLogs.push(`Updated bracket rankings (ID: ${existingRow.id}) for user: ${rankObj.user}`);
          }
        } else {
          await fetch(`${directusUrl}/items/bracket_rankings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify(rankingData)
          });
          apiLogs.push(`Created new bracket rankings for user: ${rankObj.user}`);
        }
      }
    }

    return { logs: apiLogs, totalUsers, processedCount: batchSlice.length, processedUsers: batchSlice.map(p => p.key), nextOffset: Math.min(nextOffset, totalUsers), isDone };
  } catch (err) {
    console.error("Error during ranking recalculation:", err);
    throw err;
  }
}