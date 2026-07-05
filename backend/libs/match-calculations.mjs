import { calcGroupStagePoints } from './calc-group-stage.mjs';
import { calcKnockoutStagePoints } from './calc-knockout-stage.mjs';
import { parseScorersStringForRanking, normalizePlayerName } from './match-mappings.mjs';

/**
 * Checks if key match attributes have changed to avoid unnecessary database patches
 */
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

/**
 * Evaluates match prediction score dynamically using rule profiles fetched from Directus
 */
export function calcResultForRankingGeneric(game, pronostique, ruleMatrix = []) {
    if (!game || !pronostique) return 0;
    if (game.fulltime_a === null || game.fulltime_b === null) return 0;

    const rule = ruleMatrix.find(r =>
        r.game_type === 'pronostics' &&
        r.phase === game.phase
    ) || { winner_draw_points: 0, fulltime_exact_points: 0, halftime_exact_points: 0, scorer_points: 0, consolation_points: 0 };

    let earnedPoints = 0;
    let accurateFieldsCount = 0;

    const isWinnerDrawCorrect = game.winner_draw === pronostique.winner_draw;
    const isFulltimeExact = parseInt(game.fulltime_a) === parseInt(pronostique.fulltime_a) &&
        parseInt(game.fulltime_b) === parseInt(pronostique.fulltime_b);
    const isHalftimeExact = parseInt(game.halftime_a) === parseInt(pronostique.halftime_a) &&
        parseInt(game.halftime_b) === parseInt(pronostique.halftime_b);

    if (isWinnerDrawCorrect && rule.winner_draw_points > 0) {
        earnedPoints += Number(rule.winner_draw_points);
        accurateFieldsCount++;
    }

    if (isFulltimeExact && rule.fulltime_exact_points > 0) {
        earnedPoints += Number(rule.fulltime_exact_points);
        accurateFieldsCount++;
    }

    if (isHalftimeExact && rule.halftime_exact_points > 0) {
        earnedPoints += Number(rule.halftime_exact_points);
        accurateFieldsCount++;
    }

    if (pronostique.scorer && rule.scorer_points > 0) {
        const gamescorers = game.scorers ? parseScorersStringForRanking(game.scorers) : [];
        const normalizedPronoScorer = normalizePlayerName(pronostique.scorer);
        const matchFound = gamescorers.some(s => normalizePlayerName(s) === normalizedPronoScorer);
        
        if (matchFound) {
            earnedPoints += Number(rule.scorer_points);
            accurateFieldsCount++;
        }
    }

    if (accurateFieldsCount === 0 && rule.consolation_points > 0) {
        earnedPoints += Number(rule.consolation_points);
    }

    return earnedPoints;
}

/**
 * Centrally routes point calculation tasks depending on the tournament match phase
 */
export function calcResultForRanking(game, pronostique, ruleMatrix = []) {
    if (!game) return 0;

    if (game.phase === 'Group Stage') {
        return calcGroupStagePoints(game, pronostique, ruleMatrix);
    } else {
        return calcKnockoutStagePoints(game, pronostique, ruleMatrix);
    }
}