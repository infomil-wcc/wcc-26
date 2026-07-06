import { fetchWithBypass } from './utils.mjs';
const fetch = fetchWithBypass;
import {
    getNormalizedTeamName,
    getNormalizedPhase,
    getFdMatchUtcTime,
    getWcGameApproxUtcTime,
    parseScorersString
} from './match-mappings.mjs';
import { hasMatchChanged } from './match-calculations.mjs';

/**
 * Core orchestrator to sync a list of Directus matches against external APIs
 */
export async function syncMatchesPipeline(dbMatches, { directusUrl, adminToken, apiKey }) {
    const updates = [];
    const nowIso = new Date().toISOString();
    let anyMatchJustFinished = false;

    if (!dbMatches || dbMatches.length === 0) {
        return { updates, anyMatchJustFinished };
    }

    // Use centralized API URLs with robust fallbacks
    const fdApiUrl = process.env.FOOTBALL_DATA_API_URL || 'https://api.football-data.org/v4';
    const wcApiUrl = process.env.WORLD_CUP_IR_API_URL || 'https://worldcup26.ir';

    // Concurrently fetch external data feeds
    const [externalMatches, wcGames] = await Promise.all([
        fetchFootballData(fdApiUrl, apiKey),
        fetchWcGames(wcApiUrl)
    ]);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };

    for (const dbMatch of dbMatches) {
        const dbUtcTime = new Date(dbMatch.date.trim().replace(' ', 'T') + '+04:00').getTime();

        // Find equivalent record on football-data
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
            return !(dbUtcTime && fdUtcTime && Math.abs(dbUtcTime - fdUtcTime) > 30 * 60 * 60 * 1000);
        });

        if (!fdMatch) {
            console.warn(`No matching external match found on football-data for Match ID: ${dbMatch.id}`);
            continue;
        }

        // Find equivalent record on worldcup26.ir
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
            return !(dbUtcTime && wcUtcTime && Math.abs(dbUtcTime - wcUtcTime) > 30 * 60 * 60 * 1000);
        });

        // Compute status changes with live priority fallbacks
        let newStatus = 'pending';
        const fdStatus = fdMatch.status ? fdMatch.status.toUpperCase() : '';

        if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(fdStatus)) {
            newStatus = 'live';
        } else if (fdStatus === 'FINISHED' || fdStatus === 'AWARDED') {
            newStatus = 'finished';
        } else if (dbMatch.current_status === 'live' && fdStatus !== 'FINISHED') {
            newStatus = 'live';
        }

        const oldStatus = dbMatch.current_status ? dbMatch.current_status.toLowerCase() : 'pending';
        if (newStatus === 'finished' && oldStatus !== 'finished') {
            anyMatchJustFinished = true;
        }

        // Compile goals and scores considering inverted configurations
        const isReversed = (dbMatch.team_a === getNormalizedTeamName(fdMatch.awayTeam?.name));
        
        let fdFullHome = fdMatch.score?.fullTime?.home;
        let fdFullAway = fdMatch.score?.fullTime?.away;
        let fdPenHome = null;
        let fdPenAway = null;

        if (fdMatch.score?.duration === 'PENALTY_SHOOTOUT' || fdMatch.score?.duration === 'EXTRA_TIME') {
            if (fdMatch.score?.regularTime?.home !== null && fdMatch.score?.regularTime?.home !== undefined) {
                fdFullHome = fdMatch.score.regularTime.home + (fdMatch.score?.extraTime?.home || 0);
                fdFullAway = fdMatch.score.regularTime.away + (fdMatch.score?.extraTime?.away || 0);
            }
            if (fdMatch.score?.duration === 'PENALTY_SHOOTOUT') {
                fdPenHome = fdMatch.score?.penalties?.home;
                fdPenAway = fdMatch.score?.penalties?.away;
            }
        }

        const dbScoreA = isReversed ? (fdFullAway !== null && fdFullAway !== undefined ? Number(fdFullAway) : null) : (fdFullHome !== null && fdFullHome !== undefined ? Number(fdFullHome) : null);
        const dbScoreB = isReversed ? (fdFullHome !== null && fdFullHome !== undefined ? Number(fdFullHome) : null) : (fdFullAway !== null && fdFullAway !== undefined ? Number(fdFullAway) : null);

        const dbPenaltyA = isReversed ? (fdPenAway !== null && fdPenAway !== undefined ? Number(fdPenAway) : null) : (fdPenHome !== null && fdPenHome !== undefined ? Number(fdPenHome) : null);
        const dbPenaltyB = isReversed ? (fdPenHome !== null && fdPenHome !== undefined ? Number(fdPenHome) : null) : (fdPenAway !== null && fdPenAway !== undefined ? Number(fdPenAway) : null);

        const htHome = fdMatch.score?.halfTime?.home;
        const htAway = fdMatch.score?.halfTime?.away;
        const dbHalftimeA = isReversed ? (htAway !== null && htAway !== undefined ? Number(htAway) : null) : (htHome !== null && htHome !== undefined ? Number(htHome) : null);
        const dbHalftimeB = isReversed ? (htHome !== null && htHome !== undefined ? Number(htHome) : null) : (htAway !== null && htAway !== undefined ? Number(htAway) : null);

        let winner_draw = null;
        if (dbScoreA !== null && dbScoreB !== null) {
            if (dbScoreA > dbScoreB) winner_draw = dbMatch.team_a;
            else if (dbScoreA < dbScoreB) winner_draw = dbMatch.team_b;
            else {
                if (dbPenaltyA !== null && dbPenaltyB !== null) {
                    if (dbPenaltyA > dbPenaltyB) winner_draw = dbMatch.team_a;
                    else if (dbPenaltyA < dbPenaltyB) winner_draw = dbMatch.team_b;
                    else winner_draw = 'Draw';
                } else {
                    winner_draw = 'Draw';
                }
            }
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

        if (dbPenaltyA !== null && dbPenaltyB !== null) {
            payload.penalty_a = dbPenaltyA;
            payload.penalty_b = dbPenaltyB;
        }

        if (wcGame) {
            const homeScorers = parseScorersString(wcGame.home_scorers, getNormalizedTeamName(wcGame.home_team_name_en));
            const awayScorers = parseScorersString(wcGame.away_scorers, getNormalizedTeamName(wcGame.away_team_name_en));
            
            const homePenaltyScorers = parseScorersString(wcGame.home_penalty_scorers, getNormalizedTeamName(wcGame.home_team_name_en));
            homePenaltyScorers.forEach(s => s.detail = 'Penalty Shootout');

            const awayPenaltyScorers = parseScorersString(wcGame.away_penalty_scorers, getNormalizedTeamName(wcGame.away_team_name_en));
            awayPenaltyScorers.forEach(s => s.detail = 'Penalty Shootout');

            payload.scorers = [...homeScorers, ...awayScorers, ...homePenaltyScorers, ...awayPenaltyScorers];
        } else {
            payload.scorers = [];
        }

        // Fallback to football-data.org and cross-check penalty scorers
        if (fdMatch && fdMatch.goals && Array.isArray(fdMatch.goals)) {
            const fdScorers = fdMatch.goals.map(g => {
                let detail = 'Normal Goal';
                if (g.type === 'PENALTY') detail = 'Penalty';
                else if (g.type === 'OWN_GOAL') detail = 'Own Goal';
                return {
                    time: { elapsed: g.minute, extra: g.injuryTime },
                    team: { name: getNormalizedTeamName(g.team?.name) },
                    player: { name: g.scorer?.name },
                    detail
                };
            });

            if (payload.scorers.length === 0) {
                payload.scorers = fdScorers;
            } else {
                // Cross check penalty scorers
                const fdPenalties = fdScorers.filter(s => s.detail === 'Penalty');
                for (const fdPen of fdPenalties) {
                    const exists = payload.scorers.some(s => 
                        s.detail === 'Penalty' && 
                        s.player.name === fdPen.player.name && 
                        s.time.elapsed === fdPen.time.elapsed
                    );
                    if (!exists) {
                        payload.scorers.push(fdPen);
                    }
                }
            }
        }

        let directusResponseOk = true;

        if (dbMatch.manual_override) {
            delete payload.fulltime_a;
            delete payload.fulltime_b;
            delete payload.halftime_a;
            delete payload.halftime_b;
            delete payload.penalty_a;
            delete payload.penalty_b;
            delete payload.scorers;
            delete payload.winner_draw;
        }

        if (hasMatchChanged(dbMatch, payload) || !dbMatch.status_updated || new Date(dbMatch.status_updated).getTime() < dbUtcTime) {
            const directusResponse = await fetch(`${directusUrl}/items/matches/${dbMatch.id}`, {
                method: 'PATCH',
                headers,
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

    return { updates, anyMatchJustFinished };
}

async function fetchFootballData(baseUrl, apiKey) {
    try {
        const apiRes = await fetch(`${baseUrl}/competitions/WC/matches`, {
            headers: { 'X-Auth-Token': apiKey }
        });
        if (apiRes.ok) {
            const data = await apiRes.json();
            return data.matches || [];
        }
    } catch (err) {
        console.error("Failed to fetch football-data.org:", err.message);
    }
    return [];
}

async function fetchWcGames(baseUrl) {
    try {
        const wcRes = await fetch(`${baseUrl}/get/games`, {
            headers: {
                'accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
            }
        });
        if (wcRes.ok) {
            const wcData = await wcRes.json();
            return wcData.games || [];
        }
    } catch (err) {
        console.error("Failed to fetch worldcup26.ir:", err.message);
    }
    return [];
}