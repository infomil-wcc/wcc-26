/**
 * Evaluates points for bracket milestones and final structural champion determinations
 */
export function calcBracketPoints(item, actualWinner, currentPhase, ruleMatrix = []) {
    if (!actualWinner || !item) return 0;

    // 1. Normalize strings to avoid string comparison bugs
    const targetPhaseClean = currentPhase.trim().toLowerCase();

    // 2. Locate the specific rule row safely
    const rule = ruleMatrix.find(r =>
        r.game_type === 'bracket' && r.phase.trim().toLowerCase() === targetPhaseClean
    ) || { winner_draw_points: 0, qualification_bonus_points: 0, champion_bonus_points: 0 };

    let totalBracketPoints = 0;

    // 3. Match Winner Check
    if (item.predicted_winner === actualWinner) {
        totalBracketPoints += Number(rule.winner_draw_points ?? 0);
    }

    // 4. Finalist Qualification Bonus (Applies to Semi-finals selections)
    if (targetPhaseClean === 'semi-finals' && item.predicted_finalist === actualWinner) {
        totalBracketPoints += Number(rule.qualification_bonus_points ?? 0);
    }

    // 5. Ultimate Tournament Champion Check (Applies to the Grand Final selection)
    if (item.is_grand_final && item.predicted_champion === actualWinner) {
        totalBracketPoints += Number(rule.champion_bonus_points ?? 0);
    }

    return totalBracketPoints;
}

export function sortBracketRankings(userStandingsList) {
    return userStandingsList.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.totalCorrectCount !== a.totalCorrectCount) return b.totalCorrectCount - a.totalCorrectCount;

        const phaseOrder = ['final', 'semi-finals', 'quarter-finals', 'round of 16', 'round of 32'];
        for (const phase of phaseOrder) {
            const accA = a.phaseCorrectCounts[phase] || 0;
            const accB = b.phaseCorrectCounts[phase] || 0;
            if (accB !== accA) return accB - accA;
        }
        return a.username.localeCompare(b.username);
    });
}