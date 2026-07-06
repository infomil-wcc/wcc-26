import { parseScorersStringForRanking, normalizePlayerName } from './match-mappings.mjs';
import Fuse from 'fuse.js';

/**
 * Strategy to calculate points dynamically across all varying Knockout stages
 */
export function calcKnockoutStagePoints(game, pronostique, ruleMatrix = []) {
    if (!game || !pronostique) return 0;
    if (game.fulltime_a === null || game.fulltime_b === null) return 0;

    const targetPhase = game.phase === 'Third Place' ? 'Final' : game.phase;
    const rule = ruleMatrix.find(r =>
        r.game_type === 'pronostics' && r.phase === targetPhase
    ) || { winner_draw_points: 0, fulltime_exact_points: 0, halftime_exact_points: 0, scorer_points: 0, consolation_points: 0 };

    const breakdown = {
        winner: 0,
        fulltime: 0,
        halftime: 0,
        scorer: 0,
        consolation: 0,
        total: 0,
        isFraud: false
    };

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

    if (accurateFieldsCount === 0 && rule.consolation_points > 0) {
        breakdown.consolation = Number(rule.consolation_points);
    }

    breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;
    
    // Knockout phases have a guaranteed minimum of 1 point if consolation logic allows
    if (breakdown.total === 0) {
        breakdown.consolation = 1;
        breakdown.total = 1;
    }

    return breakdown;
}