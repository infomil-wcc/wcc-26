import { parseScorersStringForRanking, normalizePlayerName } from './match-mappings.mjs';

/**
 * Strategy to calculate points for the Group Stage phase
 */
export function calcGroupStagePoints(game, pronostique, ruleMatrix = []) {
    if (!game || !pronostique) return 0;
    if (game.fulltime_a === null || game.fulltime_b === null) return 0;

    const rule = ruleMatrix.find(r =>
        r.game_type === 'pronostics' && r.phase === 'Group Stage'
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

    const isWinnerDrawCorrect = game.winner_draw === pronostique.winner_draw;
    const isFulltimeExact = parseInt(game.fulltime_a) === parseInt(pronostique.fulltime_a) &&
        parseInt(game.fulltime_b) === parseInt(pronostique.fulltime_b);
    const isHalftimeExact = parseInt(game.halftime_a) === parseInt(pronostique.halftime_a) &&
        parseInt(game.halftime_b) === parseInt(pronostique.halftime_b);

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
        const matchFound = gamescorers.some(s => normalizePlayerName(s) === normalizedPronoScorer);
        
        if (matchFound) {
            breakdown.scorer = Number(rule.scorer_points);
            accurateFieldsCount++;
        }
    }

    if (accurateFieldsCount === 0 && rule.consolation_points > 0) {
        breakdown.consolation = Number(rule.consolation_points);
    }

    breakdown.total = breakdown.winner + breakdown.fulltime + breakdown.halftime + breakdown.scorer + breakdown.consolation;

    return breakdown;
}