import { handleCors, fetchWithBypass } from '../backend/libs/utils.mjs';
import { syncMatchesPipeline } from '../backend/libs/match-core.mjs';
import { calcResultForRanking } from '../backend/libs/match-calculations.mjs';
import { calcBracketPoints } from '../backend/libs/calc-bracket-stage.mjs';
import { recalculateRankings } from '../backend/libs/calc-rankings.mjs';
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