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

  if (!apiKey) {
    return response.status(500).json({ error: "Missing FOOTBALL_DATA_API_KEY environment variable." });
  }

  const nowTime = new Date().getTime();
  const nowIso = new Date().toISOString();

  // 1. Fetch started but unfinished matches from Directus (highly selective query)
  let dbMatches = [];
  try {
    const dbRes = await fetch(`${directusUrl}/items/matches?filter[date][_lte]=${nowIso}&filter[fulltime][_neq]=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (dbRes.ok) {
      const dbData = await dbRes.json();
      dbMatches = dbData.data || [];
    }
  } catch (dbError) {
    console.error("Database Error fetching matches from Directus:", dbError.message);
  }

  // 2. Fetch live match_status entries from Directus (highly selective query)
  let dbMatchStatuses = [];
  try {
    const statusRes = await fetch(`${directusUrl}/items/match_status?filter[status][_eq]=live`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      dbMatchStatuses = statusData.data || [];
    }
  } catch (e) {
    console.error("Failed to fetch match_status:", e.message);
  }

  // Early Exit: if no matches have started and no match statuses are active, skip external calls and updates
  if (dbMatches.length === 0 && dbMatchStatuses.length === 0) {
    return response.status(200).json({
      success: true,
      message: "No started or live matches require syncing.",
      updates: [],
      formUpdates: []
    });
  }

  let externalMatches = [];

  // Fetch from football-data.org API
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

  // Fetch games from worldcup26.ir (for rich scorer details)
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

  // Evaluate started matches and insert rows in match_status
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

  // Identify target match IDs to update
  const liveMatchIds = dbMatchStatuses
    .filter(s => s.status === 'live')
    .map(s => parseInt(s.match_id, 10));

  // Map and update matches
  const results = [];

  try {
    for (const dbMatch of dbMatches) {
      const matchIdNum = parseInt(dbMatch.id, 10);
      
      // Update ONLY match IDs that are currently marked "live"
      if (!liveMatchIds.includes(matchIdNum)) {
        continue;
      }

      // Find corresponding football-data match
      const fdMatch = externalMatches.find(m => {
        const home = getNormalizedTeamName(m.homeTeam?.name);
        const away = getNormalizedTeamName(m.awayTeam?.name);
        return (dbMatch.team_a === home && dbMatch.team_b === away) ||
               (dbMatch.team_a === away && dbMatch.team_b === home);
      });

      if (!fdMatch) continue;

      // Find corresponding worldcup26.ir game
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

      const htHome = fdMatch.score?.halfTime?.home;
      const htAway = fdMatch.score?.halfTime?.away;
      const targetHtA = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htAway) : Number(htHome)) : null;
      const targetHtB = (htHome !== null && htHome !== undefined && htAway !== null && htAway !== undefined) ? (isReversed ? Number(htHome) : Number(htAway)) : null;

      // Parse scorers from worldcup26.ir if found
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

      const isFinished = fdMatch.status === "FINISHED";
      const payload = {
        match_id: parseInt(dbMatch.id, 10),
        fulltime_a: dbScoreA,
        fulltime_b: dbScoreB,
        halftime_a: targetHtA,
        halftime_b: targetHtB,
        scorers: scorers
      };

      if (isFinished) {
        payload.fulltime = true;
        let winnerDraw = "Draw";
        if (dbScoreA > dbScoreB) winnerDraw = dbMatch.team_a;
        else if (dbScoreB > dbScoreA) winnerDraw = dbMatch.team_b;
        payload.winner_draw = winnerDraw;
      }

      // Update match record in Directus
      const directusResponse = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
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
        status: "Updated",
        success: directusResponse.ok
      });

      const statusObj = dbMatchStatuses.find(s => parseInt(s.match_id, 10) === matchIdNum);
      if (statusObj) {
        const matchStartedAt = new Date(statusObj.started_at || dbMatch.date).getTime();
        const elapsedMinutes = (new Date().getTime() - matchStartedAt) / (60 * 1000);

        if (elapsedMinutes >= 180 || isFinished || payload.fulltime) {
          try {
            await fetch(`${directusUrl}/items/match_status/${statusObj.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
              },
              body: JSON.stringify({
                status: 'finished'
              })
            });
            console.log(`Updated status to finished for match ID ${dbMatch.id}`);
          } catch (err) {
            console.error(`Failed to update match_status for match ID ${dbMatch.id}:`, err.message);
          }
        }
      }
    }

    // If any matches were updated, delete pronostiques_rankings to force recalculation
    if (results.length > 0) {
      try {
        const rankRes = await fetch(`${directusUrl}/items/pronostiques_rankings?limit=-1`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (rankRes.ok) {
          const rankData = await rankRes.json();
          const ids = (rankData.data || []).map(r => r.id);
          if (ids.length > 0) {
            await fetch(`${directusUrl}/items/pronostiques_rankings`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
              },
              body: JSON.stringify(ids)
            });
            console.log(`Successfully deleted ${ids.length} pronostiques_rankings records to force leaderboard recalculation.`);
          }
        }
      } catch (err) {
        console.error("Failed to clear pronostiques_rankings:", err.message);
      }
    }

  } catch (error) {
    console.error("Data Sync Processing Error:", error);
    return response.status(500).json({ error: error.message });
  }

  // ── Phase 2: Update team form (forme1–forme5) ──────────────────────────
  const formUpdates = [];
  try {
    const teamsRes = await fetch(`${directusUrl}/items/teams?limit=-1&fields=id,name`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!teamsRes.ok) {
      throw new Error(`Directus teams fetch failed with HTTP status ${teamsRes.status}`);
    }

    const teamsData = await teamsRes.json();
    const dbTeams = teamsData.data || [];

    const teamMap = {};
    for (const t of dbTeams) {
      teamMap[t.name] = t;
    }

    const finishedMatches = externalMatches
      .filter(m => m.status === "FINISHED")
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    const teamOutcomes = {};

    for (const m of finishedMatches) {
      const homeScore = m.score?.fullTime?.home;
      const awayScore = m.score?.fullTime?.away;
      if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
        continue;
      }

      const homeName = getNormalizedTeamName(m.homeTeam?.name);
      const awayName = getNormalizedTeamName(m.awayTeam?.name);

      if (!homeName || !awayName) continue;

      let homeOutcome, awayOutcome;
      if (homeScore > awayScore) {
        homeOutcome = 'W'; awayOutcome = 'L';
      } else if (awayScore > homeScore) {
        homeOutcome = 'L'; awayOutcome = 'W';
      } else {
        homeOutcome = 'D'; awayOutcome = 'D';
      }

      if (!teamOutcomes[homeName]) teamOutcomes[homeName] = [];
      if (!teamOutcomes[awayName]) teamOutcomes[awayName] = [];
      teamOutcomes[homeName].push(homeOutcome);
      teamOutcomes[awayName].push(awayOutcome);
    }

    for (const [teamName, outcomes] of Object.entries(teamOutcomes)) {
      const dbTeam = teamMap[teamName];
      if (!dbTeam) {
        console.warn(`Team not found in Directus: ${teamName}`);
        continue;
      }

      const last5 = outcomes.slice(-5);
      while (last5.length < 5) last5.unshift('');

      const formPayload = {
        forme1: last5[0],
        forme2: last5[1],
        forme3: last5[2],
        forme4: last5[3],
        forme5: last5[4]
      };

      const formRes = await fetch(`${directusUrl}/items/teams/${dbTeam.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(formPayload)
      });

      formUpdates.push({
        team: teamName,
        id: dbTeam.id,
        form: last5.join(''),
        success: formRes.ok
      });
    }

  } catch (formError) {
    console.error("Team Form Update Error:", formError.message);
    return response.status(200).json({
      success: true,
      message: `Synchronisation effectuée. ${results.length} matchs mis à jour. Erreur lors de la mise à jour de la forme des équipes.`,
      updates: results,
      formUpdates: [],
      formError: formError.message
    });
  }

  return response.status(200).json({
    success: true,
    message: `Synchronisation football-data effectuée. ${results.length} matchs terminés/en direct mis à jour. ${formUpdates.length} équipes mises à jour.`,
    updates: results,
    formUpdates
  });
}