import { readJsonFile } from './utils.mjs';

export async function generateGameRules(fetchInstance, directusUrl, adminToken) {
    // 1. Always initialize a fallback framework structurally
    let gameData = { elements: [] };

    try {
        gameData = await readJsonFile('game-rules-data.json');
    } catch (jsonErr) {
        console.error("❌ Critical: Failed to read local game-rules-data.json file:", jsonErr.message);
        // Return a valid JSON skeleton so Angular doesn't choke on parsing
        return { elements: [] };
    }

    let rulesMatrix = [];
    let matchesList = [];

    // 2. Fetch with localized try/catch blocks
    try {
        const [rulesRes, matchesRes] = await Promise.all([
            fetchInstance(`${directusUrl}/items/game_scoring_rules?limit=-1`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }),
            fetchInstance(`${directusUrl}/items/matches?limit=-1`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            })
        ]);

        if (rulesRes && rulesRes.ok) {
            const payloadRules = await rulesRes.json().catch(() => ({}));
            rulesMatrix = payloadRules.data || [];
        }
        if (matchesRes && matchesRes.ok) {
            const payloadMatches = await matchesRes.json().catch(() => ({}));
            matchesList = payloadMatches.data || [];
        }
    } catch (apiErr) {
        console.warn("⚠️ Directus query failed, continuing with file-system fallbacks:", apiErr.message);
    }

    // Ensure gameData.elements exists safely before iterating
    if (!gameData.elements || !Array.isArray(gameData.elements)) {
        return { elements: [] };
    }

    // 3. Keep your map conversion algorithm safe
    gameData.elements = gameData.elements.map(element => {
        try {
            if (element.id === 'jeu_pronostics') {
                const targetPhases = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

                const getScoringRuleValue = (phaseName, fieldName) => {
                    const targetPhaseClean = phaseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                    const row = rulesMatrix.find(r => {
                        const dbType = String(r.game_type || '').toLowerCase().trim();
                        const dbPhaseClean = String(r.phase || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                        return (dbType === 'pronostics' || dbType === 'match_prediction') && dbPhaseClean === targetPhaseClean;
                    });
                    if (!row || !fieldName) return 0;
                    const value = row[fieldName];
                    return (value === undefined || value === null || value === "0") ? 0 : Number(value);
                };

                const matchCounts = targetPhases.map(phase => {
                    if (phase === 'Final') {
                        return (matchesList.filter(m => m.phase === 'Final' || m.phase === 'Third Place').length) || 2;
                    }
                    if (phase === 'Semi-finals') {
                        return (matchesList.filter(m => m.phase === 'Semi-finals').length) || 2;
                    }
                    const count = matchesList.filter(m => m.phase === phase).length;
                    if (count > 0) return count;

                    if (phase === 'Group Stage') return 72;
                    if (phase === 'Round of 32') return 16;
                    if (phase === 'Round of 16') return 8;
                    if (phase === 'Quarter-finals') return 4;
                    return 0;
                });

                const getDynamicCellPoints = (phaseName, ruleField, matchFlagField) => {
                    const matchesInPhase = matchesList.filter(m => m.phase === phaseName);
                    if (matchesInPhase.length === 0 || ruleField === 'winner_draw_points' || ruleField === 'consolation_points') {
                        return getScoringRuleValue(phaseName, ruleField);
                    }
                    const isCategoryActive = matchesInPhase.some(m => m[matchFlagField] === true);
                    return isCategoryActive ? getScoringRuleValue(phaseName, ruleField) : 0;
                };

                const maxPointsPerMatch = targetPhases.map(phase => {
                    return getDynamicCellPoints(phase, 'winner_draw_points', null) +
                        getDynamicCellPoints(phase, 'fulltime_exact_points', 'fulltime') +
                        getDynamicCellPoints(phase, 'halftime_exact_points', 'halftime') +
                        getDynamicCellPoints(phase, 'scorer_points', 'scorer');
                });

                const totalPointsPossibleRow = matchCounts.map((count, idx) => count * maxPointsPerMatch[idx]);
                const grandTotalCompetitionPoints = totalPointsPossibleRow.reduce((sum, val) => sum + val, 0);

                const formatCell = (val, prefix = "") => {
                    if (val === 0 || val === "0" || !val) return "-";
                    return prefix ? `${prefix}${val}` : val;
                };

                element.bareme_points_detaille.rows = [
                    { "cat": "Trouver le bon vainqueur", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'winner_draw_points', null))) },
                    { "cat": "Score final (jusqu'à prolongation)", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'fulltime_exact_points', 'fulltime'), "+")) },
                    { "cat": "Score mi-temps", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'halftime_exact_points', 'halftime'), "+")) },
                    { "cat": "Nom d'un buteur", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'scorer_points', 'scorer'), "+")) },
                    { "cat": "Point de consolation (si 0 pt)", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'consolation_points', null))) },
                    { "cat": "Nombre de matchs", "vals": matchCounts },
                    { "cat": "Points max possible / match", "vals": maxPointsPerMatch },
                    { "cat": "Total points possible", "vals": totalPointsPossibleRow }
                ];
                element.bareme_points_detaille.total_points_competition = grandTotalCompetitionPoints;

                if (element.exemples_calcul) {
                    element.exemples_calcul.forEach(ex => {
                        let total = 0;
                        if (ex.details) {
                            ex.details.forEach(det => {
                                const pts = getScoringRuleValue(det.phase, det.field);
                                det.points = pts;
                                total += pts;
                            });
                        }
                        ex.total = total;
                    });
                }
            }

            if (element.id === 'jeu_bracket') {
                const getBracketVal = (phaseName, fieldName = 'winner_draw_points') => {
                    const targetPhaseClean = phaseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                    const row = rulesMatrix.find(r => {
                        const dbType = String(r.game_type || '').toLowerCase().trim();
                        const dbPhaseClean = String(r.phase || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                        return dbType === 'bracket' && dbPhaseClean === targetPhaseClean;
                    });
                    return row ? Number(row[fieldName] || 0) : 0;
                };

                const r32Pts = getBracketVal('Round of 32', 'winner_draw_points');
                const r16Pts = getBracketVal('Round of 16', 'winner_draw_points');
                const qfPts = getBracketVal('Quarter-finals', 'winner_draw_points');
                const sfBonus = getBracketVal('Semi-finals', 'qualification_bonus_points');
                const fBonus = getBracketVal('Final', 'champion_bonus_points');

                element.bareme_points = {
                    "32eme_de_finale": r32Pts,
                    "16eme_de_finale": r16Pts,
                    "8eme_de_finale": qfPts,
                    "demi_finale": sfBonus,
                    "finale": fBonus
                };
                element.bonus_equipe_finale = sfBonus;
                element.maximum_possible = (16 * r32Pts) + (8 * r16Pts) + (4 * qfPts) + (2 * sfBonus) + fBonus;
            }
        } catch (elementMappingErr) {
            console.error(`❌ Mapping crash on element ${element?.id}:`, elementMappingErr.message);
        }
        return element;
    });

    return gameData;
}