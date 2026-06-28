import { readJsonFile } from './utils.mjs';

/**
 * Generates and maps dynamic game rules from Directus and local fallbacks.
 * @param {Function} fetchInstance - The custom fetch instance (fetchWithBypass).
 * @param {string} directusUrl - Base URL for the Directus API.
 * @param {string} adminToken - Authorization token for Directus.
 * @returns {Promise<Object>} The fully computed game rules payload.
 */
export async function generateGameRules(fetchInstance, directusUrl, adminToken) {
    // 1. Lire la structure de base du fichier JSON
    const gameData = await readJsonFile('game-rules-data.json');

    // 2. Récupérer les données de Directus (Règles + Matchs)
    let rulesMatrix = [];
    let matchesList = [];

    try {
        const [rulesRes, matchesRes] = await Promise.all([
            fetchInstance(`${directusUrl}/items/game_scoring_rules?limit=-1`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }),
            fetchInstance(`${directusUrl}/items/matches?limit=-1`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            })
        ]);

        if (rulesRes.ok) {
            const payloadRules = await rulesRes.json();
            rulesMatrix = payloadRules.data || [];
        }
        if (matchesRes.ok) {
            const payloadMatches = await matchesRes.json();
            matchesList = payloadMatches.data || [];
        }
    } catch (apiErr) {
        console.error("⚠️ Erreur lors de la récupération des données Directus (utilisation des fallbacks) :", apiErr.message);
    }

    gameData.elements = gameData.elements.map(element => {
        if (element.id === 'jeu_pronostics') {
            // Les 6 phases uniques ordonnées pour correspondre parfaitement aux colonnes HTML
            const targetPhases = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

            // Récupération sécurisée d'une valeur dans game_scoring_rules
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

            // --- CALCULS DU NOMBRE DE MATCHS (Basé sur la collection matches) ---
            const matchCounts = targetPhases.map(phase => {
                if (phase === 'Final') {
                    const finalCount = matchesList.filter(m => m.phase === 'Final').length;
                    const thirdPlaceCount = matchesList.filter(m => m.phase === 'Third Place').length;
                    const count = finalCount + thirdPlaceCount;
                    return count > 0 ? count : 2;
                }
                if (phase === 'Semi-finals') {
                    const count = matchesList.filter(m => m.phase === 'Semi-finals').length;
                    return count > 0 ? count : 2;
                }

                const count = matchesList.filter(m => m.phase === phase).length;
                if (count > 0) return count;

                // Fallbacks structurels si les matchs sont en mode Draft / Invisibles
                if (phase === 'Group Stage') return 72;
                if (phase === 'Round of 32') return 16;
                if (phase === 'Round of 16') return 8;
                if (phase === 'Quarter-finals') return 4;
                return 0;
            });

            // --- CORRECTION CRITIQUE DES CELLULES ---
            const getDynamicCellPoints = (phaseName, ruleField, matchFlagField) => {
                const matchesInPhase = matchesList.filter(m => m.phase === phaseName);

                if (matchesInPhase.length === 0) {
                    return getScoringRuleValue(phaseName, ruleField);
                }

                if (ruleField === 'winner_draw_points' || ruleField === 'consolation_points') {
                    return getScoringRuleValue(phaseName, ruleField);
                }

                const isCategoryActive = matchesInPhase.some(m => m[matchFlagField] === true);
                return isCategoryActive ? getScoringRuleValue(phaseName, ruleField) : 0;
            };

            // Calcul des points max par match pour chaque phase
            const maxPointsPerMatch = targetPhases.map(phase => {
                return getDynamicCellPoints(phase, 'winner_draw_points', null) +
                    getDynamicCellPoints(phase, 'fulltime_exact_points', 'fulltime') +
                    getDynamicCellPoints(phase, 'halftime_exact_points', 'halftime') +
                    getDynamicCellPoints(phase, 'scorer_points', 'scorer');
            });

            // Calcul de la ligne "Total points possible"
            const totalPointsPossibleRow = matchCounts.map((count, idx) => count * maxPointsPerMatch[idx]);
            const grandTotalCompetitionPoints = totalPointsPossibleRow.reduce((sum, val) => sum + val, 0);

            const formatCell = (val, prefix = "") => {
                if (val === 0 || val === "0" || !val) return "-";
                return prefix ? `${prefix}${val}` : val;
            };

            // Synchronisation automatique des exemples de calcul
            if (element.exemples_calcul && Array.isArray(element.exemples_calcul)) {
                element.exemples_calcul = element.exemples_calcul.map(scenario => {
                    let runningScenarioTotal = 0;
                    scenario.details = scenario.details.map(item => {
                        let flagField = null;
                        if (item.field === 'fulltime_exact_points') flagField = 'fulltime';
                        if (item.field === 'halftime_exact_points') flagField = 'halftime';
                        if (item.field === 'scorer_points') flagField = 'scorer';

                        const resolvedPoints = getDynamicCellPoints(item.phase, item.field, flagField);
                        runningScenarioTotal += resolvedPoints;

                        return { prediction: item.prediction, points: resolvedPoints };
                    });
                    scenario.total = runningScenarioTotal;
                    return scenario;
                });
            }

            // Mapping final vers Angular
            element.bareme_points_detaille.rows = [
                { "cat": "Trouver le bon vainqueur / Match nul", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'winner_draw_points', null))) },
                { "cat": "Score final (jusqu'à prolongation)", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'fulltime_exact_points', 'fulltime'), "+")) },
                { "cat": "Score mi-temps", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'halftime_exact_points', 'halftime'), "+")) },
                { "cat": "Nom d'un buteur", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'scorer_points', 'scorer'), "+")) },
                { "cat": "Point de consolation (si 0 pt)", "vals": targetPhases.map(p => formatCell(getDynamicCellPoints(p, 'consolation_points', null))) },
                { "cat": "Nombre de matchs", "vals": matchCounts },
                { "cat": "Points max possible / match", "vals": maxPointsPerMatch },
                { "cat": "Total points possible", "vals": totalPointsPossibleRow }
            ];

            element.bareme_points_detaille.total_points_competition = grandTotalCompetitionPoints;
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

            // Fixed dot notation structural syntax bug encountered previously by using valid object strings
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

        return element;
    });

    return gameData;
}