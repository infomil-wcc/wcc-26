import { fetchWithBypass } from './utils.mjs';

function isPlaceholder(teamName) {
  if (!teamName) return true;
  const name = teamName.toLowerCase().trim();
  return name.includes('winner') || name.includes('runner-up') || name.includes('play-off') || name.includes('à déterminer');
}

function isMatchFinished(match) {
  return match && String(match.current_status || '').toLowerCase() === 'finished' && match.fulltime_a !== null && match.fulltime_b !== null;
}

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
    const playedInGroup = matchesInGroup.filter(isMatchFinished);
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
        if (r32.manual_override) {
          continue;
        }
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
        if (isMatchFinished(refMatch)) {
          const winner = Number(refMatch.fulltime_a) > Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_a: winner };
        } else if (refMatch) {
          console.debug(`Skipping auto-advance for match ${match.id} because referenced match ${refMatchId} is not finished`);
        }
      } else if (runnerUpPlaceholderA) {
        const refMatchId = match.team_a.split('Runner-up Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (isMatchFinished(refMatch)) {
          const runnerUp = Number(refMatch.fulltime_a) < Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_a: runnerUp };
        }
      }

      if (winnerPlaceholderB) {
        const refMatchId = match.team_b.split('Winner Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (isMatchFinished(refMatch)) {
          const winner = Number(refMatch.fulltime_a) > Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_b: winner };
        } else if (refMatch) {
          console.debug(`Skipping auto-advance for match ${match.id} because referenced match ${refMatchId} is not finished`);
        }
      } else if (runnerUpPlaceholderB) {
        const refMatchId = match.team_b.split('Runner-up Match ')[1];
        const refMatch = allMatches.find(m => String(m.id) === String(refMatchId));
        if (isMatchFinished(refMatch)) {
          const runnerUp = Number(refMatch.fulltime_a) < Number(refMatch.fulltime_b) ? refMatch.team_a : refMatch.team_b;
          updatedPayload = { ...updatedPayload, team_b: runnerUp };
        }
      }

      if (updatedPayload) {
        if (match.manual_override) {
          continue;
        }
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
