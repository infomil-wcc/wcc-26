import { calcGroupStagePoints } from './calc-group-stage.mjs';
import { calcKnockoutStagePoints } from './calc-knockout-stage.mjs';
import { parseScorersStringForRanking, normalizePlayerName } from './match-mappings.mjs';
import Fuse from 'fuse.js';

/**
 * Checks if key match attributes have changed to avoid unnecessary database patches
 */
export function hasMatchChanged(dbMatch, payload) {
    if ('fulltime_a' in payload && dbMatch.fulltime_a != payload.fulltime_a) return true;
    if ('fulltime_b' in payload && dbMatch.fulltime_b != payload.fulltime_b) return true;
    if ('halftime_a' in payload && dbMatch.halftime_a != payload.halftime_a) return true;
    if ('halftime_b' in payload && dbMatch.halftime_b != payload.halftime_b) return true;
    if ('penalty_a' in payload && dbMatch.penalty_a != payload.penalty_a) return true;
    if ('penalty_b' in payload && dbMatch.penalty_b != payload.penalty_b) return true;
    if ('winner_draw' in payload && dbMatch.winner_draw != payload.winner_draw) return true;
    if ('current_status' in payload && dbMatch.current_status != payload.current_status) return true;

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
    const emptyBreakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
    if (!game || !pronostique) return emptyBreakdown;
    if (game.fulltime_a === null || game.fulltime_b === null) return emptyBreakdown;

    const rule = ruleMatrix.find(r =>
        r.game_type === 'pronostics' &&
        r.phase === game.phase
    ) || { winner_draw_points: 0, fulltime_exact_points: 0, halftime_exact_points: 0, scorer_points: 0, consolation_points: 0 };

    const breakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
    let accurateFieldsCount = 0;

    const getScore = (val) => (val === '-' || val === null || val === undefined || val === '') ? 0 : parseInt(val);

    let inferredWinnerDraw = pronostique.winner_draw;
    if (!inferredWinnerDraw || inferredWinnerDraw.trim() === '') {
        const hasScoreA = (pronostique.fulltime_a !== null && pronostique.fulltime_a !== undefined && pronostique.fulltime_a !== '' && pronostique.fulltime_a !== '-');
        const hasScoreB = (pronostique.fulltime_b !== null && pronostique.fulltime_b !== undefined && pronostique.fulltime_b !== '' && pronostique.fulltime_b !== '-');
        
        if (hasScoreA || hasScoreB) {
            const pScoreA = getScore(pronostique.fulltime_a);
            const pScoreB = getScore(pronostique.fulltime_b);
            if (pScoreA > pScoreB) inferredWinnerDraw = game.team_a;
            else if (pScoreA < pScoreB) inferredWinnerDraw = game.team_b;
            else inferredWinnerDraw = 'Draw';
        }
    }

    const isWinnerDrawCorrect = game.winner_draw === inferredWinnerDraw;
    const isFulltimeExact = getScore(game.fulltime_a) === getScore(pronostique.fulltime_a) &&
        getScore(game.fulltime_b) === getScore(pronostique.fulltime_b);
    const isHalftimeExact = getScore(game.halftime_a) === getScore(pronostique.halftime_a) &&
        getScore(game.halftime_b) === getScore(pronostique.halftime_b);

    if (isWinnerDrawCorrect && rule.winner_draw_points > 0) {
        breakdown.winner = Number(rule.winner_draw_points);
        accurateFieldsCount++;
    }

    if (isFulltimeExact && rule.fulltime_exact_points > 0) {
        breakdown.fulltime = Number(rule.fulltime_exact_points);
        accurateFieldsCount++;
    }

    if (isHalftimeExact && rule.halftime_exact_points > 0) {
        breakdown.halftime = Number(rule.halftime_exact_points);
        accurateFieldsCount++;
    }

    if (pronostique.scorer && rule.scorer_points > 0) {
        const gamescorers = game.scorers ? parseScorersStringForRanking(game.scorers) : [];
        const normalizedPronoScorer = normalizePlayerName(pronostique.scorer);
        const normalizedGameScorers = gamescorers.map(s => normalizePlayerName(s));

        const fuse = new Fuse(normalizedGameScorers, {
            includeScore: true,
            threshold: 0.4
        });

        const results = fuse.search(normalizedPronoScorer);
        const matchFound = results.length > 0;
        
        if (matchFound) {
            breakdown.scorer = Number(rule.scorer_points);
            accurateFieldsCount++;
        }
    }

    if (game.phase !== 'Group Stage' && game.phase !== 'Round of 32') {
        if (accurateFieldsCount === 0 && rule.consolation_points > 0) {
            breakdown.consolation = Number(rule.consolation_points);
        }
        breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;
    } else {
        breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer;
    }
    return breakdown;
}

/**
 * Centrally routes point calculation tasks depending on the tournament match phase
 */
export function calcResultForRanking(game, pronostique, ruleMatrix = []) {
    const emptyBreakdown = { winner: 0, fulltime: 0, halftime: 0, scorer: 0, consolation: 0, total: 0, isFraud: false };
    if (!game) return emptyBreakdown;

    if (game.phase === 'Group Stage') {
        return calcGroupStagePoints(game, pronostique, ruleMatrix);
    } else {
        return calcKnockoutStagePoints(game, pronostique, ruleMatrix);
    }
}