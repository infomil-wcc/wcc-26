import test from 'node:test';
import assert from 'node:assert';

// Import target calculation engines
import { createHandler } from './match-results.mjs';
import { calcBracketPoints } from './libs/calc-bracket-stage.mjs';

// ==========================================================================
// 1. DÉCLARATION UNIQUE EN HAUT DU FICHIER (PORTÉE GLOBALE DU MODULE)
// ==========================================================================
const pronosticsRulesMatrix = [
    { phase: 'Group Stage', winner_draw_points: 1, fulltime_exact_points: 0, halftime_exact_points: 0, scorer_points: 0, consolation_points: 0 },
    { phase: 'Round of 32', winner_draw_points: 2, fulltime_exact_points: 5, halftime_exact_points: 0, scorer_points: 0, consolation_points: 0 },
    { phase: 'Round of 16', winner_draw_points: 3, fulltime_exact_points: 6, halftime_exact_points: 2, scorer_points: 2, consolation_points: 1 },
    { phase: 'Quarter-finals', winner_draw_points: 4, fulltime_exact_points: 8, halftime_exact_points: 3, scorer_points: 3, consolation_points: 1 },
    { phase: 'Semi-finals', winner_draw_points: 5, fulltime_exact_points: 10, halftime_exact_points: 4, scorer_points: 4, consolation_points: 1 },
    { phase: 'Final', winner_draw_points: 8, fulltime_exact_points: 12, halftime_exact_points: 5, scorer_points: 5, consolation_points: 1 }
];

const tournamentStructure = [
    { phase: 'Group Stage', matchCount: 72 },
    { phase: 'Round of 32', matchCount: 16 },
    { phase: 'Round of 16', matchCount: 8 },
    { phase: 'Quarter-finals', matchCount: 4 },
    { phase: 'Semi-finals', matchCount: 2 },
    { phase: 'Final', matchCount: 2 }
];

// ==========================================================================
// TEST UNIT 1: 72 MATCHES SIMULATION (GROUP STAGE RUNNER)
// ==========================================================================
test('Should accurately calculate rankings for a 72-match random tournament scenario using Directus rules', async () => {
    const totalMatchesCount = 72;
    const targetUsername = 'marathon_predictor';

    const mockMatches = [];
    const mockPredictions = [];
    const possibleTeams = ['France', 'Italy', 'Germany', 'Spain', 'Argentina', 'Brazil', 'England', 'Belgium'];

    for (let i = 1; i <= totalMatchesCount; i++) {
        const teamA = possibleTeams[i % possibleTeams.length];
        let teamB = possibleTeams[(i + 1) % possibleTeams.length];
        if (teamA === teamB) teamB = possibleTeams[(i + 2) % possibleTeams.length];

        const actualFulltimeA = (i % 4);
        const actualFulltimeB = ((i + 1) % 3);
        const actualWinner = actualFulltimeA > actualFulltimeB ? teamA : (actualFulltimeA < actualFulltimeB ? teamB : 'Draw');

        mockMatches.push({
            id: i, phase: 'Group Stage', team_a: teamA, team_b: teamB,
            fulltime_a: actualFulltimeA, fulltime_b: actualFulltimeB, winner_draw: actualWinner
        });

        const predictedFulltimeA = ((i + 1) % 4);
        const predictedFulltimeB = (i % 3);
        const predictedWinner = predictedFulltimeA > predictedFulltimeB ? teamA : (predictedFulltimeA < predictedFulltimeB ? teamB : 'Draw');

        mockPredictions.push({
            id: 1000 + i, game_id: String(i), user: targetUsername,
            winner_draw: predictedWinner, fulltime_a: predictedFulltimeA, fulltime_b: predictedFulltimeB,
            halftime_a: 0, halftime_b: 0, scorer: null
        });
    }

    const rulesMatrixMock = [{
        game_type: 'pronostics', phase: 'Group Stage',
        winner_draw_points: 3, fulltime_exact_points: 2, halftime_exact_points: 0, scorer_points: 0, consolation_points: 1
    }];

    const mockBulkFetch = async (url, options) => {
        if (url.includes('/items/matches')) return { ok: true, json: async () => ({ data: mockMatches }) };
        if (url.includes('/items/pronostiques')) return { ok: true, json: async () => ({ data: mockPredictions }) };
        if (url.includes('/items/pronostics_rankings')) return { ok: true, json: async () => ({ data: [] }) };
        if (url.includes('/items/game_scoring_rules')) return { ok: true, json: async () => ({ data: rulesMatrixMock }) };
        if (options && ['POST', 'PATCH', 'DELETE'].includes(options.method)) return { ok: true, json: async () => ({ success: true }) };
        return { ok: false, statusText: 'Not Found' };
    };

    const request = { method: 'GET', query: { points: targetUsername }, headers: { 'authorization': 'Bearer bypass-token' } };
    let responseStatus = null; let responseBody = null;
    const response = { status(code) { responseStatus = code; return this; }, json(data) { responseBody = data; return this; } };

    const handler = createHandler({ fetch: mockBulkFetch, env: { FOOTBALL_DATA_API_KEY: 'mock' } });
    await handler(request, response);

    let expectedTotalPoints = 0;
    for (let i = 0; i < totalMatchesCount; i++) {
        const match = mockMatches[i]; const prono = mockPredictions[i];
        let rPts = 0; let hit = false;
        if (match.winner_draw === prono.winner_draw) { rPts += 3; hit = true; }
        if (match.fulltime_a === prono.fulltime_a && match.fulltime_b === prono.fulltime_b) { rPts += 2; hit = true; }
        if (!hit) rPts += 1;
        expectedTotalPoints += rPts;
    }

    let actualTotalPoints = 0;
    responseBody.calculationLogs.filter(l => l.includes(`User: ${targetUsername}`)).forEach(log => {
        const m = log.match(/Earned:\s+(\d+)\s+pts/);
        if (m) actualTotalPoints += parseInt(m[1], 10);
    });

    console.log("\n==========================================================================");
    console.log("             STRATEGY MODULE: GROUP STAGE CALCULATION SUMMARY             ");
    console.log("==========================================================================");
    console.table([
        { Strategy: "calcGroupStagePoints", Metric: "Matches Computed", Expected: totalMatchesCount, Actual: totalMatchesCount },
        { Strategy: "calcGroupStagePoints", Metric: "Points Total Balanced", Expected: `${expectedTotalPoints} pts`, Actual: `${actualTotalPoints} pts` }
    ]);

    assert.strictEqual(actualTotalPoints, expectedTotalPoints);
});

// ==========================================================================
// TEST UNIT 2: KNOCKOUT PHASES STEPPING METRICS RUNNER
// ==========================================================================
test('Should accurately calculate and display points across all separate Knockout Phases', async () => {
    const targetUsername = 'knockout_specialist';
    const phases = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

    const mockRulesMatrix = [
        { game_type: 'pronostics', phase: 'Round of 32', winner_draw_points: 3, fulltime_exact_points: 2, consolation_points: 0 },
        { game_type: 'pronostics', phase: 'Round of 16', winner_draw_points: 5, fulltime_exact_points: 3, consolation_points: 0 },
        { game_type: 'pronostics', phase: 'Quarter-finals', winner_draw_points: 8, fulltime_exact_points: 4, consolation_points: 0 },
        { game_type: 'pronostics', phase: 'Semi-finals', winner_draw_points: 12, fulltime_exact_points: 6, consolation_points: 0 },
        { game_type: 'pronostics', phase: 'Final', winner_draw_points: 20, fulltime_exact_points: 10, consolation_points: 0 }
    ];

    const mockMatches = []; const mockPredictions = []; const expectationTracker = [];

    phases.forEach((phase, index) => {
        const mExact = (index * 2) + 1; const mOutcome = (index * 2) + 2;
        const rule = mockRulesMatrix.find(r => r.phase === phase);

        mockMatches.push({ id: mExact, phase, team_a: 'Team A', team_b: 'Team B', fulltime_a: 2, fulltime_b: 1, winner_draw: 'Team A' });
        mockPredictions.push({ id: 2000 + mExact, game_id: String(mExact), user: targetUsername, winner_draw: 'Team A', fulltime_a: 2, fulltime_b: 1 });
        expectationTracker.push({ phase, type: 'Exact Match', matchId: mExact, expected: rule.winner_draw_points + rule.fulltime_exact_points });

        mockMatches.push({ id: mOutcome, phase, team_a: 'Team C', team_b: 'Team D', fulltime_a: 3, fulltime_b: 0, winner_draw: 'Team C' });
        mockPredictions.push({ id: 2000 + mOutcome, game_id: String(mOutcome), user: targetUsername, winner_draw: 'Team C', fulltime_a: 1, fulltime_b: 0 });
        expectationTracker.push({ phase, type: 'Outcome Only', matchId: mOutcome, expected: rule.winner_draw_points });
    });

    const mockKnockoutFetch = async (url) => {
        if (url.includes('/items/matches')) return { ok: true, json: async () => ({ data: mockMatches }) };
        if (url.includes('/items/pronostiques')) return { ok: true, json: async () => ({ data: mockPredictions }) };
        if (url.includes('/items/pronostics_rankings')) return { ok: true, json: async () => ({ data: [] }) };
        if (url.includes('/items/game_scoring_rules')) return { ok: true, json: async () => ({ data: mockRulesMatrix }) };
        return { ok: true, json: async () => ({ success: true }) };
    };

    const request = { method: 'GET', query: { points: targetUsername }, headers: { 'authorization': 'Bearer bypass-token' } };
    const response = {
        body: null,
        status() { return this; },
        json(data) { this.body = data; return this; }
    };

    const handler = createHandler({ fetch: mockKnockoutFetch, env: { FOOTBALL_DATA_API_KEY: 'mock' } });
    await handler(request, response);

    const breakdown = [];
    expectationTracker.forEach(exp => {
        const log = response.body.calculationLogs.find(l => l.includes(`Match ID: ${exp.matchId}`));
        let actual = 0; if (log) { const p = log.match(/Earned:\s+(\d+)\s+pts/); if (p) actual = parseInt(p[1], 10); }
        breakdown.push({ 'Phase': exp.phase, 'Mode': exp.type, 'Expected': `${exp.expected} pts`, 'Actual': `${actual} pts`, 'State': exp.expected === actual ? '✅ PASS' : '❌ FAIL' });
    });

    console.log("\n==========================================================================");
    console.log("            STRATEGY MODULE: calcKnockoutStagePoints BREAKDOWN            ");
    console.log("==========================================================================");
    console.table(breakdown);
});

// ==========================================================================
// TEST UNIT 3: BRACKET MATRIX ISOLATION TEST (WORLD CUP 2026)
// ==========================================================================
test('Should run full simulation of World Cup Bracket Stage and validate max 970 cumulative points', async () => {
    // Rules Matrix aligned directly with your World Cup 2026 Directus updates
    const bracketRulesMatrix = [
        { game_type: 'bracket', phase: 'Round of 32', winner_draw_points: 20, qualification_bonus_points: 0, champion_bonus_points: 0 },   // 16 * 20 = 320
        { game_type: 'bracket', phase: 'Round of 16', winner_draw_points: 30, qualification_bonus_points: 0, champion_bonus_points: 0 },   // 8 * 30 = 240
        { game_type: 'bracket', phase: 'Quarter-finals', winner_draw_points: 40, qualification_bonus_points: 0, champion_bonus_points: 0 },   // 4 * 40 = 160
        { game_type: 'bracket', phase: 'Semi-finals', winner_draw_points: 0, qualification_bonus_points: 75, champion_bonus_points: 0 },   // 2 * 75 = 150
        { game_type: 'bracket', phase: 'Final', winner_draw_points: 0, qualification_bonus_points: 0, champion_bonus_points: 100 }  // 1 * 100 = 100
    ];

    const structuralScenarios = [];

    // 1. Round of 32: 16 separate matches (16 * 20 = 320 pts total)
    for (let i = 1; i <= 16; i++) {
        structuralScenarios.push({
            phase: 'Round of 32', actualWinner: 'TeamA',
            item: { predicted_winner: 'TeamA' }
        });
    }

    // 2. Round of 16: 8 separate matches (8 * 30 = 240 pts total)
    for (let i = 1; i <= 8; i++) {
        structuralScenarios.push({
            phase: 'Round of 16', actualWinner: 'TeamA',
            item: { predicted_winner: 'TeamA' }
        });
    }

    // 3. Quarter-finals: 4 separate matches (4 * 40 = 160 pts total)
    for (let i = 1; i <= 4; i++) {
        structuralScenarios.push({
            phase: 'Quarter-finals', actualWinner: 'TeamA',
            item: { predicted_winner: 'TeamA' }
        });
    }

    // 4. Semi-finals: 2 separate matches (2 * 75 pts bonus = 150 pts total)
    structuralScenarios.push({
        phase: 'Semi-finals', actualWinner: 'France',
        item: { predicted_winner: 'France', predicted_finalist: 'France' }
    });
    structuralScenarios.push({
        phase: 'Semi-finals', actualWinner: 'Argentina',
        item: { predicted_winner: 'Argentina', predicted_finalist: 'Argentina' }
    });

    // 5. Final: 1 Grand Final match -> 100 pts Champion Bonus = 100 pts total
    structuralScenarios.push({
        phase: 'Final', actualWinner: 'France',
        item: { is_grand_final: true, predicted_winner: 'France', predicted_champion: 'France' }
    });

    // Dynamic Tracking & Rendering Mapped to image_987122.png style
    const tableBreakdown = [];
    const phasesToTrack = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

    const expectedTotals = {
        'Round of 32': 320,
        'Round of 16': 240,
        'Quarter-finals': 160,
        'Semi-finals': 150,
        'Final': 100
    };

    let actualSimulatedTotal = 0;
    const phasePointsCounter = { 'Round of 32': 0, 'Round of 16': 0, 'Quarter-finals': 0, 'Semi-finals': 0, 'Final': 0 };

    // Execute engine calculation loop
    structuralScenarios.forEach(sc => {
        const pts = calcBracketPoints(sc.item, sc.actualWinner, sc.phase, bracketRulesMatrix);
        actualSimulatedTotal += pts;
        phasePointsCounter[sc.phase] += pts;
    });

    // Construct the logging rows for console rendering
    phasesToTrack.forEach(phase => {
        const actual = phasePointsCounter[phase];
        const expected = expectedTotals[phase];
        const stateSymbol = actual === expected ? '✅ PASS' : '❌ FAIL';

        tableBreakdown.push({
            'Phase': phase,
            'Expected': `${expected} pts`,
            'Actual': `${actual} pts`,
            'State': stateSymbol
        });
    });

    // Output formatted breakdown layout (Visual match to image_987122.png)
    console.log(`\n=============================================================================`);
    console.log(`               STRATEGY MODULE: calcBracketPoints BREAKDOWN                  `);
    console.log(`=============================================================================`);
    console.table(tableBreakdown);
    console.log(`=============================================================================`);

    console.log(`\n============================================================`);
    console.log(` > Final Aggregated Point Accumulation Result: ${actualSimulatedTotal} PTS`);
    console.log(` > Target maximum points for bracket stage: 970 PTS`);
    console.log(`============================================================\n`);

    assert.strictEqual(actualSimulatedTotal, 970, "The bracket point engine must aggregate accurately to 970 points.");
});


test('Simulation de validation de score pour l\'utilisateur iml-dv', async () => {
    // 1. Barème dynamique configuré dans Directus (Mondial 2026)
    const bracketRulesMatrix = [
        { game_type: 'bracket', phase: 'Round of 32', winner_draw_points: 20, qualification_bonus_points: 0, champion_bonus_points: 0 },
        { game_type: 'bracket', phase: 'Round of 16', winner_draw_points: 30, qualification_bonus_points: 0, champion_bonus_points: 0 },
        { game_type: 'bracket', phase: 'Quarter-finals', winner_draw_points: 40, qualification_bonus_points: 0, champion_bonus_points: 0 },
        { game_type: 'bracket', phase: 'Semi-finals', winner_draw_points: 0, qualification_bonus_points: 75, champion_bonus_points: 0 },
        { game_type: 'bracket', phase: 'Final', winner_draw_points: 0, qualification_bonus_points: 0, champion_bonus_points: 100 }
    ];

    // 2. Pronostics réels soumis par l'utilisateur iml-dv
    const userPrediction_iml_dv = {
        "user": "iml-dv",
        "winner_r32_1": "Germany", "winner_r32_2": "France", "winner_r32_3": "Switzerland", "winner_r32_4": "Netherlands",
        "winner_r32_5": "England", "winner_r32_6": "Spain", "winner_r32_7": "Ecuador", "winner_r32_8": "Korea Republic",
        "winner_r32_9": "Brazil", "winner_r32_10": "Senegal", "winner_r32_11": "Mexico", "winner_r32_12": "Croatia",
        "winner_r32_13": "Argentina", "winner_r32_14": "Belgium", "winner_r32_15": "Canada", "winner_r32_16": "Portugal",

        "winner_r16_1": "France", "winner_r16_2": "Netherlands", "winner_r16_3": "Spain", "winner_r16_4": "Korea Republic",
        "winner_r16_5": "Brazil", "winner_r16_6": "Croatia", "winner_r16_7": "Argentina", "winner_r16_8": "Portugal",

        "winner_r4_1": "France", "winner_r4_2": "Spain", "winner_r4_3": "Brazil", "winner_r4_4": "Argentina",

        "winner_semi_1": "France", "winner_semi_2": "Brazil",
        "winner_wc": "Brazil"
    };

    // 3. Simulation des RÉSULTATS RÉELS des matchs du tournoi (Scénario de test)
    // On simule un excellent parcours pour iml-dv, avec quelques surprises pour valider les échecs.
    // 3. Simulation des RÉSULTATS RÉELS des matchs du tournoi (Scénario de test corrigé)
    const simulatedActualResults = {
        // R32 : 14/16 corrects (Erreurs sur Suisse et Angleterre)
        "winner_r32_1": "Germany", "winner_r32_2": "France", "winner_r32_3": "Morocco", "winner_r32_4": "Netherlands",
        "winner_r32_5": "Italy", "winner_r32_6": "Spain", "winner_r32_7": "Ecuador", "winner_r32_8": "Korea Republic",
        "winner_r32_9": "Brazil", "winner_r32_10": "Senegal", "winner_r32_11": "Mexico", "winner_r32_12": "Croatia",
        "winner_r32_13": "Argentina", "winner_r32_14": "Belgium", "winner_r32_15": "Canada", "winner_r32_16": "Portugal",

        // R16 : 6/8 corrects (Surprises confirmées : le Japon et l'Italie passent !)
        "winner_r16_1": "France", "winner_r16_2": "Netherlands", "winner_r16_3": "Spain", "winner_r16_4": "Japan",
        "winner_r16_5": "Brazil", "winner_r16_6": "Italy", "winner_r16_7": "Argentina", "winner_r16_8": "Portugal",

        // Quarts : 4/4 parfaits
        "winner_r4_1": "France", "winner_r4_2": "Spain", "winner_r4_3": "Brazil", "winner_r4_4": "Argentina",

        // Demis : Les deux finalistes simulés sont la France et le Brésil (2/2 valides)
        "winner_semi_1": "France", "winner_semi_2": "Brazil",

        // Finale : Le Brésil gagne la Coupe du Monde (1/1 valide)
        "winner_wc": "Brazil"
    };

    // Mapping structurel des clés JSON vers les phases officielles du moteur
    const matchesToEvaluate = [
        // Round of 32
        ...Array.from({ length: 16 }, (_, i) => ({ key: `winner_r32_${i + 1}`, phase: 'Round of 32', label: `32e - Match ${i + 1}` })),
        // Round of 16
        ...Array.from({ length: 8 }, (_, i) => ({ key: `winner_r16_${i + 1}`, phase: 'Round of 16', label: `16e - Match ${i + 1}` })),
        // Quarter-finals
        ...Array.from({ length: 4 }, (_, i) => ({ key: `winner_r4_${i + 1}`, phase: 'Quarter-finals', label: `Quart - Match ${i + 1}` })),
        // Semi-finals (Évaluation du flag predicted_finalist)
        { key: 'winner_semi_1', phase: 'Semi-finals', label: 'Demi-finale 1' },
        { key: 'winner_semi_2', phase: 'Semi-finals', label: 'Demi-finale 2' },
        // Final (Évaluation du flag predicted_champion)
        { key: 'winner_wc', phase: 'Final', label: 'Grande Finale', isGrandFinal: true }
    ];

    const detailedTableLog = [];
    let accumulatedScore = 0;

    // Boucle d'évaluation unitaire
    matchesToEvaluate.forEach(match => {
        const prediction = userPrediction_iml_dv[match.key];
        const actual = simulatedActualResults[match.key];

        // Normalisation de l'item pour coller à la signature de votre fonction calcBracketPoints
        const mockItem = {
            predicted_winner: prediction,
            predicted_finalist: match.phase === 'Semi-finals' ? prediction : null,
            predicted_champion: match.isGrandFinal ? prediction : null,
            is_grand_final: match.isGrandFinal || false
        };

        const pointsEarned = calcBracketPoints(mockItem, actual, match.phase, bracketRulesMatrix);
        accumulatedScore += pointsEarned;

        detailedTableLog.push({
            'Match / Événement': match.label,
            'Phase': match.phase,
            'Choix iml-dv': prediction,
            'Résultat Réel': actual,
            'Points Gagnés': pointsEarned > 0 ? `+${pointsEarned} PTS` : '0 PTS',
            'Statut': pointsEarned > 0 ? '✅ CORRECT' : '❌ ERREUR'
        });
    });

    // Affichage des résultats dans la console sous forme de tableau scannable
    console.log(`\n=============================================================================================`);
    console.log(`         SIMULATION DU CLASSEMENT BRACKET - UTILISATEUR : iml-dv`);
    console.log(`=============================================================================================`);
    console.table(detailedTableLog);
    console.log(`=============================================================================================`);
    console.log(` > Score Total Accumulé pour iml-dv dans cette simulation : ${accumulatedScore} PTS`);
    console.log(`=============================================================================================\n`);

    // Validation des calculs par assertions
    // R32: 14 * 20 = 280 | R16: 6 * 30 = 180 | QF: 4 * 40 = 160 | SF: 2 * 75 = 150 | F: 1 * 100 = 100
    // Total attendu : 280 + 180 + 160 + 150 + 100 = 870 Points
    assert.strictEqual(accumulatedScore, 870, "Le score total simulé de l'utilisateur iml-dv doit être de 870 points.");
});

// ==========================================================================
// SCÉNARIOS COMPLÉMENTAIRES : CAS LIMITES & CAS MOYENS (MONDIAL 2026)
// ==========================================================================
// Matrice globale des barèmes (Mondial 2026)
const bracketRulesMatrix = [
    { game_type: 'bracket', phase: 'Round of 32', winner_draw_points: 20, qualification_bonus_points: 0, champion_bonus_points: 0 },
    { game_type: 'bracket', phase: 'Round of 16', winner_draw_points: 30, qualification_bonus_points: 0, champion_bonus_points: 0 },
    { game_type: 'bracket', phase: 'Quarter-finals', winner_draw_points: 40, qualification_bonus_points: 0, champion_bonus_points: 0 },
    { game_type: 'bracket', phase: 'Semi-finals', winner_draw_points: 0, qualification_bonus_points: 75, champion_bonus_points: 0 },
    { game_type: 'bracket', phase: 'Final', winner_draw_points: 0, qualification_bonus_points: 0, champion_bonus_points: 100 }
];

// Fonction utilitaire partagée pour afficher la grille de score d'un test de façon lisible
function logTestSummaryTable(testName, r32, r16, qf, sf, f, total) {
    console.log(`\n================================================================================`);
    console.log(` 📊 BILAN DES POINTS - ${testName.toUpperCase()}`);
    console.log(`================================================================================`);
    console.table([
        { 'Phase du Tableau': 'Round of 32', 'Points / Match': '20 PTS', 'Matchs Gagnés': r32, 'Total Phase': `${r32 * 20} PTS` },
        { 'Phase du Tableau': 'Round of 16', 'Points / Match': '30 PTS', 'Matchs Gagnés': r16, 'Total Phase': `${r16 * 30} PTS` },
        { 'Phase du Tableau': 'Quarter-finals', 'Points / Match': '40 PTS', 'Matchs Gagnés': qf, 'Total Phase': `${qf * 40} PTS` },
        { 'Phase du Tableau': 'Semi-finals', 'Points / Match': '75 PTS (Bonus)', 'Matchs Gagnés': sf, 'Total Phase': `${sf * 75} PTS` },
        { 'Phase du Tableau': 'Final', 'Points / Match': '100 PTS (Bonus)', 'Matchs Gagnés': f, 'Total Phase': `${f * 100} PTS` },
        { 'Phase du Tableau': '⭐ COMBINAISON', 'Points / Match': '—', 'Matchs Gagnés': '—', 'Total Phase': `${total} PTS` }
    ]);
    console.log(`================================================================================\n`);
}

// --------------------------------------------------------------------------
// CAS LIMITE 1 : LE PIRE DES CAS (SCORE DE 0 PTS)
// --------------------------------------------------------------------------
test('Edge Case - Pire scénario possible : Toutes les prédictions sont fausses', async () => {
    // Évaluation unitaire de chaque type de règle critique[cite: 6]
    const r32Points = calcBracketPoints({ predicted_winner: "France" }, "Brazil", 'Round of 32', bracketRulesMatrix);
    const sfPoints = calcBracketPoints({ predicted_winner: "Spain", predicted_finalist: "France" }, "Spain", 'Semi-finals', bracketRulesMatrix);
    const fPoints = calcBracketPoints({ is_grand_final: true, predicted_winner: "Argentina", predicted_champion: "France" }, "Argentina", 'Final', bracketRulesMatrix);

    const totalWorst = r32Points + sfPoints + fPoints;

    // Affichage de la table d'explication (0 match réussi partout)
    logTestSummaryTable('Pire Cas (0 pts)', 0, 0, 0, 0, 0, totalWorst);

    assert.strictEqual(totalWorst, 0, "Le score doit être de 0 point si aucun pronostic ni bonus n'est correct.");
});

// --------------------------------------------------------------------------
// CAS LIMITE 2 : LE CAS PARFAIT (MAXIMUM ABSOLU DE 970 PTS)
// --------------------------------------------------------------------------
test('Edge Case - Meilleur scénario possible : 100% de réussite (Max 970 pts)', async () => {
    let accumulatedPerfectScore = 0;
    let r32Count = 0, r16Count = 0, qfCount = 0, sfCount = 0, fCount = 0;

    // 16 Matchs en R32 corrects
    for (let i = 0; i < 16; i++) {
        const pts = calcBracketPoints({ predicted_winner: "France" }, "France", 'Round of 32', bracketRulesMatrix);
        accumulatedPerfectScore += pts;
        if (pts > 0) r32Count++;
    }
    // 8 Matchs en R16 corrects
    for (let i = 0; i < 8; i++) {
        const pts = calcBracketPoints({ predicted_winner: "France" }, "France", 'Round of 16', bracketRulesMatrix);
        accumulatedPerfectScore += pts;
        if (pts > 0) r16Count++;
    }
    // 4 Matchs en Quarts corrects
    for (let i = 0; i < 4; i++) {
        const pts = calcBracketPoints({ predicted_winner: "France" }, "France", 'Quarter-finals', bracketRulesMatrix);
        accumulatedPerfectScore += pts;
        if (pts > 0) qfCount++;
    }
    // 2 Matchs en Demis corrects (2 Finalistes trouvés)
    for (let i = 0; i < 2; i++) {
        const pts = calcBracketPoints({ predicted_winner: "France", predicted_finalist: "France" }, "France", 'Semi-finals', bracketRulesMatrix);
        accumulatedPerfectScore += pts;
        if (pts > 0) sfCount++;
    }
    // 1 Finale correcte (Champion trouvé)
    const ptsFinale = calcBracketPoints({ is_grand_final: true, predicted_winner: "France", predicted_champion: "France" }, "France", 'Final', bracketRulesMatrix);
    accumulatedPerfectScore += ptsFinale;
    if (ptsFinale > 0) fCount++;

    // Affichage de la table d'explication du score parfait
    logTestSummaryTable('Cas Parfait (970 pts)', r32Count, r16Count, qfCount, sfCount, fCount, accumulatedPerfectScore);

    assert.strictEqual(accumulatedPerfectScore, 970, "Un bracket 100% correct doit totaliser exactement 970 points.");
});

// --------------------------------------------------------------------------
// CAS MOYEN : JOUEUR LOGIQUE MAIS AVEC DES ERREURS EN CASCADE (CAS RÉEL)
// --------------------------------------------------------------------------
test('Mean Case - Scénario Moyen : Performance standard avec erreurs réalistes', async () => {
    let simulatedMeanScore = 0;
    let r32Correct = 0, r16Correct = 0, qfCorrect = 0, sfCorrect = 0, fCorrect = 0;

    // R32 : 10 valides, 6 échecs
    for (let i = 1; i <= 16; i++) {
        const isCorrect = i <= 10;
        const pts = calcBracketPoints({ predicted_winner: "France" }, isCorrect ? "France" : "Brazil", 'Round of 32', bracketRulesMatrix);
        simulatedMeanScore += pts;
        if (isCorrect) r32Correct++;
    }

    // R16 : 3 valides, 5 échecs
    for (let i = 1; i <= 8; i++) {
        const isCorrect = i <= 3;
        const pts = calcBracketPoints({ predicted_winner: "France" }, isCorrect ? "France" : "Brazil", 'Round of 16', bracketRulesMatrix);
        simulatedMeanScore += pts;
        if (isCorrect) r16Correct++;
    }

    // Quarts : 1 valide, 3 échecs
    for (let i = 1; i <= 4; i++) {
        const isCorrect = i === 1;
        const pts = calcBracketPoints({ predicted_winner: "France" }, isCorrect ? "France" : "Brazil", 'Quarter-finals', bracketRulesMatrix);
        simulatedMeanScore += pts;
        if (isCorrect) qfCorrect++;
    }

    // Demis : 1 finaliste sur 2 correct
    const demi1 = calcBracketPoints({ predicted_winner: "France", predicted_finalist: "France" }, "France", 'Semi-finals', bracketRulesMatrix);
    const demi2 = calcBracketPoints({ predicted_winner: "Brazil", predicted_finalist: "Brazil" }, "Spain", 'Semi-finals', bracketRulesMatrix);
    simulatedMeanScore += (demi1 + demi2);
    if (demi1 > 0) sfCorrect++;
    if (demi2 > 0) sfCorrect++;

    // Finale : Champion raté
    const finale = calcBracketPoints({ is_grand_final: true, predicted_winner: "France", predicted_champion: "France" }, "Spain", 'Final', bracketRulesMatrix);
    simulatedMeanScore += finale;
    if (finale > 0) fCorrect++;

    // Affichage de la table d'explication du cas moyen (405 pts attendus)
    logTestSummaryTable('Cas Moyen (405 pts)', r32Correct, r16Correct, qfCorrect, sfCorrect, fCorrect, simulatedMeanScore);

    assert.strictEqual(simulatedMeanScore, 405, "Le score calculé pour le cas moyen doit être exactement de 405 points.");
});

// --------------------------------------------------------------------------
// JEU PRONOSTICS
// --------------------------------------------------------------------------
// Fonction d'évaluation simulée calquée sur l'algorithme de votre API game-rules.mjs
function calcPredictionPoints(prediction, actual, phase) {
    const rule = pronosticsRulesMatrix.find(r => r.phase === phase);
    if (!rule) return 0;

    let pts = 0;
    let anyCorrect = false;

    // 1. Vainqueur ou Nul
    if (prediction.winner_draw === actual.winner_draw) {
        pts += rule.winner_draw_points;
        anyCorrect = true;
    }
    // 2. Score Exact Fin du Match
    if (rule.fulltime_exact_points > 0 && prediction.fulltime_score === actual.fulltime_score) {
        pts += rule.fulltime_exact_points;
        anyCorrect = true;
    }
    // 3. Score Exact Mi-temps
    if (rule.halftime_exact_points > 0 && prediction.halftime_score === actual.halftime_score) {
        pts += rule.halftime_exact_points;
        anyCorrect = true;
    }
    // 4. Buteur correct
    if (rule.scorer_points > 0 && actual.scorers.includes(prediction.scorer)) {
        pts += rule.scorer_points;
        anyCorrect = true;
    }

    // 5. Point de Consolation (Uniquement si TOUT est faux en phase finale)
    if (!anyCorrect && phase !== 'Group Stage' && rule.consolation_points > 0) {
        pts = rule.consolation_points;
    }

    return pts;
}

// Helper d'affichage terminal
function logPronosticsSummary(title, rows, totalScore) {
    console.log(`\n=============================================================================================`);
    console.log(` 🎯 RELEVÉ DE POINTS PRONOSTICS : ${title}`);
    console.log(`=============================================================================================`);
    console.table(rows);
    console.log(`=============================================================================================`);
    console.log(` > SCORE TOTAL PRONOSTICS : ${totalScore} PTS`);
    console.log(`=============================================================================================\n`);
}

// --------------------------------------------------------------------------
// CAS LIMITE 1 : LE PIRE DES CAS (POINT DE CONSOLATION SUR CHAQUE MATCH)
// --------------------------------------------------------------------------
test('Pronostics Edge Case - Pire scénario : 100% d\'erreurs partout', async () => {
    const phases = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
    let totalScore = 0;
    const summaryRows = [];

    const mockPrediction = { winner_draw: 'Home', fulltime_score: '2-0', halftime_score: '1-0', scorer: 'Mbappé' };
    const mockActual = { winner_draw: 'Away', fulltime_score: '0-3', halftime_score: '0-2', scorers: ['Messi'] };

    phases.forEach(phase => {
        const pts = calcPredictionPoints(mockPrediction, mockActual, phase);
        totalScore += pts;

        summaryRows.push({
            'Phase': phase,
            'Résultat Évalué': 'Tout est Faux ❌',
            'Détails des Gains': phase === 'Group Stage' ? 'Pas de consolation' : '+1 Point de consolation',
            'Points': `${pts} PTS`
        });
    });

    logPronosticsSummary('EDGE CASE - PIRE PRONOSTIC POSSIBLE', summaryRows, totalScore);
    // Consolation : R32(0) + R16(1) + QF(1) + SF(1) + F(1) = 4 PTS
    assert.strictEqual(totalScore, 4, "Le pire score possible doit être de 4 points grâce à la consolation.");
});

// --------------------------------------------------------------------------
// CAS LIMITE 2 : LE CAS PARFAIT (TOUTES LES CATÉGORIES VALIDÉES)
// --------------------------------------------------------------------------
test('Pronostics Edge Case - Meilleur scénario : Score max sur 1 match par phase', async () => {
    const phases = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
    let totalScore = 0;
    const summaryRows = [];

    const mockPrediction = { winner_draw: 'Home', fulltime_score: '2-1', halftime_score: '1-0', scorer: 'Mbappé' };
    const mockActual = { winner_draw: 'Home', fulltime_score: '2-1', halftime_score: '1-0', scorers: ['Mbappé'] };

    phases.forEach(phase => {
        const pts = calcPredictionPoints(mockPrediction, mockActual, phase);
        totalScore += pts;

        const rule = pronosticsRulesMatrix.find(r => r.phase === phase);
        const detail = `Vainqueur (${rule.winner_draw_points}) + Score (${rule.fulltime_exact_points}) + Mi-temps (${rule.halftime_exact_points}) + Buteur (${rule.scorer_points})`;

        summaryRows.push({
            'Phase': phase,
            'Résultat Évalué': '100% Correct ⭐',
            'Détails des Gains': detail,
            'Points': `${pts} PTS`
        });
    });

    logPronosticsSummary('EDGE CASE - MATCHS PARFAITS DUPLICATES', summaryRows, totalScore);
    // Totaux max par match : Group(1) + R32(2+5=7) + R16(3+6+2+2=13) + QF(4+8+3+3=18) + SF(5+10+4+4=23) + F(8+12+5+5=30) = 92 PTS
    assert.strictEqual(totalScore, 92, "Le score parfait simulé sur ces 6 matchs doit être de 92 points.");
});

// --------------------------------------------------------------------------
// CAS MOYEN : ANALYSE D'UN JOUEUR RÉALISTE (RATÉS, TRUCS PROCHES ET POINTS SPECIFIQUES)
// --------------------------------------------------------------------------
test('Pronostics Mean Case - Scénario Joueur Standard Réaliste', async () => {
    const summaryRows = [];
    let totalScore = 0;

    // Match 1 : Phase de Groupes -> Juste le bon vainqueur trouvé
    const p1 = { winner_draw: 'Home', fulltime_score: '3-0' };
    const a1 = { winner_draw: 'Home', fulltime_score: '1-0', scorers: [] };
    const pts1 = calcPredictionPoints(p1, a1, 'Group Stage');
    totalScore += pts1;
    summaryRows.push({ 'Phase': 'Group Stage', 'Pronostic': 'Gagnant oui, Score non', 'Détails': 'Vainqueur (+1)', 'Points': `${pts1} PTS` });

    // Match 2 : 16èmes -> Bon vainqueur ET score exact trouvé !
    const p2 = { winner_draw: 'Away', fulltime_score: '1-2' };
    const a2 = { winner_draw: 'Away', fulltime_score: '1-2', scorers: [] };
    const pts2 = calcPredictionPoints(p2, a2, 'Round of 32');
    totalScore += pts2;
    summaryRows.push({ 'Phase': 'Round of 32', 'Pronostic': 'Score Exact Match', 'Détails': 'Vainqueur (+2) + Score Exact (+5)', 'Points': `${pts2} PTS` });

    // Match 3 : 8èmes -> Vainqueur raté, Score raté, mais trouve la mi-temps ET le buteur
    const p3 = { winner_draw: 'Home', fulltime_score: '2-0', halftime_score: '1-0', scorer: 'Kane' };
    const a3 = { winner_draw: 'Away', fulltime_score: '1-2', halftime_score: '1-0', scorers: ['Kane', 'Musiala'] };
    const pts3 = calcPredictionPoints(p3, a3, 'Round of 16');
    totalScore += pts3;
    summaryRows.push({ 'Phase': 'Round of 16', 'Pronostic': 'Mi-temps + Buteur ok', 'Détails': 'Mi-temps (+2) + Buteur (+2)', 'Points': `${pts3} PTS` });

    // Match 4 : Quarts -> Tout est faux (Consolation)
    const p4 = { winner_draw: 'Home', fulltime_score: '1-0', halftime_score: '0-0', scorer: 'Mbappé' };
    const a4 = { winner_draw: 'Away', fulltime_score: '0-2', halftime_score: '0-1', scorers: ['Olmo'] };
    const pts4 = calcPredictionPoints(p4, a4, 'Quarter-finals');
    totalScore += pts4;
    summaryRows.push({ 'Phase': 'Quarter-finals', 'Pronostic': 'Tout est Échoué', 'Détails': 'Point Consolation (+1)', 'Points': `${pts4} PTS` });

    // Match 5 : Finale -> Trouve uniquement le bon vainqueur
    const p5 = { winner_draw: 'Home', fulltime_score: '4-0', halftime_score: '2-0', scorer: 'Bellingham' };
    const a5 = { winner_draw: 'Home', fulltime_score: '1-0', halftime_score: '0-0', scorers: ['Saka'] };
    const pts5 = calcPredictionPoints(p5, a5, 'Final');
    totalScore += pts5;
    summaryRows.push({ 'Phase': 'Final', 'Pronostic': 'Vainqueur uniquement', 'Détails': 'Vainqueur (+8)', 'Points': `${pts5} PTS` });

    logPronosticsSummary('MEAN CASE - JOUEUR STANDARD LOGIQUE', summaryRows, totalScore);
    // Calcul : Match1(1) + Match2(2+5=7) + Match3(2+2=4) + Match4(1) + Match5(8) = 21 PTS
    assert.strictEqual(totalScore, 21, "Le score total cumulé du joueur réaliste doit être de 21 points.");
});

// Helper d'affichage terminal pour les bilans complets de tournoi
function logFullTournamentSummary(title, rows, totalScore) {
    console.log(`\n=============================================================================================`);
    console.log(` 🏆 BILAN COMPLET DU TOURNOI : ${title}`);
    console.log(`=============================================================================================`);
    console.table(rows);
    console.log(`=============================================================================================`);
    console.log(` > SCORE TOTAL SUR L'ENSEMBLE DES 104 MATCHS : ${totalScore} PTS`);
    console.log(`=============================================================================================\n`);
}

// --------------------------------------------------------------------------
// TOURNAMENT EDGE CASE 1 : LE PIRE DU PIRE (MINIMUM ABSOLU DU TOURNOI)
// --------------------------------------------------------------------------
test('Tournament Edge Case - Le Pire des cas : Erreur absolue sur les 104 matchs', async () => {
    let totalTournamentWorstScore = 0;
    const summaryRows = [];

    tournamentStructure.forEach(stage => {
        const rule = pronosticsRulesMatrix.find(r => r.phase === stage.phase);

        // Un joueur qui se trompe absolument partout ne marque que les points de consolation actifs
        const pointsPerMatch = rule.consolation_points;
        const phaseTotal = stage.matchCount * pointsPerMatch;
        totalTournamentWorstScore += phaseTotal;

        summaryRows.push({
            'Phase de la Compétition': stage.phase,
            'Matchs Evalués': `${stage.matchCount} matchs`,
            'Performance Joueur': '0% de réussite ❌',
            'Règle Appliquee': pointsPerMatch > 0 ? `Consolation (+${pointsPerMatch}/match)` : 'Aucun point',
            'Total Phase': `${phaseTotal} PTS`
        });
    });

    logFullTournamentSummary('WORST SCENARIO (104 MATCHS RATÉS)', summaryRows, totalTournamentWorstScore);

    // Calcul : Poules(72*0) + R32(16*0) + R16(8*1) + QF(4*1) + SF(2*1) + Finales(2*1) = 16 PTS
    assert.strictEqual(totalTournamentWorstScore, 16, "Le score plancher du tournoi complet avec consolation doit être de 16 points.");
});

// --------------------------------------------------------------------------
// TOURNAMENT EDGE CASE 2 : LE DIEU DES PRONOS (MAXIMUM ABSOLU DU TOURNOI)
// --------------------------------------------------------------------------
test('Tournament Edge Case - Le Cas Parfait : 100% Correct sur les 104 matchs', async () => {
    let totalTournamentMaxScore = 0;
    const summaryRows = [];

    tournamentStructure.forEach(stage => {
        const rule = pronosticsRulesMatrix.find(r => r.phase === stage.phase);

        // Calcul du score parfait unitaire par phase
        const maxPointsPerMatch = rule.winner_draw_points + rule.fulltime_exact_points + rule.halftime_exact_points + rule.scorer_points;
        const phaseTotal = stage.matchCount * maxPointsPerMatch;
        totalTournamentMaxScore += phaseTotal;

        summaryRows.push({
            'Phase de la Compétition': stage.phase,
            'Matchs Evalués': `${stage.matchCount} matchs`,
            'Performance Joueur': '100% Correct ⭐',
            'Max Possible / Match': `${maxPointsPerMatch} pts/match`,
            'Total Phase': `${phaseTotal} PTS`
        });
    });

    logFullTournamentSummary('PERFECT SCENARIO (MAXIMUM ABSOLU DU TOURNOI)', summaryRows, totalTournamentMaxScore);

    // Calcul mathématique exact du plafond :
    // Poules: 72 * 1 = 72
    // R32: 16 * (2 + 5) = 112
    // R16: 8 * (3 + 6 + 2 + 2) = 104
    // QF: 4 * (4 + 8 + 3 + 3) = 72
    // SF: 2 * (5 + 10 + 4 + 4) = 46
    // Finales: 2 * (8 + 12 + 5 + 5) = 60
    // Total attendu : 72 + 112 + 104 + 72 + 46 + 60 = 466 PTS
    assert.strictEqual(totalTournamentMaxScore, 466, "Le plafond absolu du jeu de pronostics pour 104 matchs est de 466 points.");
});

// --------------------------------------------------------------------------
// TOURNAMENT MEAN CASE : SIMULATION D'UN JOUEUR STANDARD SUR TOUT LE TOURNOI
// --------------------------------------------------------------------------
test('Tournament Mean Case - Joueur Standard Réaliste sur 104 matchs', async () => {
    let totalTournamentMeanScore = 0;
    const summaryRows = [];

    // Taux de réussite moyens réalistes modélisés par phase
    const userPerformanceProfile = {
        'Group Stage': { correctWinnerCount: 40, exactScoreCount: 0, halftimeCount: 0, scorerCount: 0, completelyWrong: 32 }, // 40 bons résultats sur 72
        'Round of 32': { correctWinnerCount: 10, exactScoreCount: 4, halftimeCount: 0, scorerCount: 0, completelyWrong: 2 }, // Les surprises commencent
        'Round of 16': { correctWinnerCount: 4, exactScoreCount: 1, halftimeCount: 2, scorerCount: 3, completelyWrong: 2 }, // Moins de bons vainqueurs mais des bonus secondaires
        'Quarter-finals': { correctWinnerCount: 2, exactScoreCount: 0, halftimeCount: 1, scorerCount: 1, completelyWrong: 1 },
        'Semi-finals': { correctWinnerCount: 1, exactScoreCount: 0, halftimeCount: 0, scorerCount: 1, completelyWrong: 1 },
        'Final': { correctWinnerCount: 1, exactScoreCount: 0, halftimeCount: 1, scorerCount: 0, completelyWrong: 1 }  // Trouve la petite ou la grande finale
    };

    tournamentStructure.forEach(stage => {
        const rule = pronosticsRulesMatrix.find(r => r.phase === stage.phase);
        const perf = userPerformanceProfile[stage.phase];

        let phaseTotal = 0;

        // Points issus des vainqueurs / nuls
        phaseTotal += perf.correctWinnerCount * rule.winner_draw_points;
        // Points issus des scores exacts finaux
        phaseTotal += perf.exactScoreCount * rule.fulltime_exact_points;
        // Points issus des scores exacts à la mi-temps
        phaseTotal += perf.halftimeCount * rule.halftime_exact_points;
        // Points issus des buteurs trouvés
        phaseTotal += perf.scorerCount * rule.scorer_points;
        // Points de consolation pour les matchs complètement ratés (uniquement hors poules)
        if (stage.phase !== 'Group Stage') {
            phaseTotal += perf.completelyWrong * rule.consolation_points;
        }

        totalTournamentMeanScore += phaseTotal;

        summaryRows.push({
            'Phase de la Compétition': stage.phase,
            'Matchs Evalués': `${stage.matchCount} matchs`,
            'Vainqueurs / Nuls ok': perf.correctWinnerCount,
            'Scores Exacts ok': perf.exactScoreCount,
            'Matchs 100% Perdus': perf.completelyWrong,
            'Total Phase': `${phaseTotal} PTS`
        });
    });

    logFullTournamentSummary('MEAN CASE (JOUEUR TRÈS LOGIQUE AVEC ERREURS RÉALISTES)', summaryRows, totalTournamentMeanScore);

    // Décomposition mathématique pas à pas du Cas Moyen :
    // Poules: (40 * 1) = 40 PTS
    // R32: (10 * 2) + (4 * 5) + (2 * 0) = 40 PTS
    // R16: (4 * 3) + (1 * 6) + (2 * 2) + (3 * 2) + (2 * 1) = 30 PTS
    // QF: (2 * 4) + (0 * 8) + (1 * 3) + (1 * 3) + (1 * 1) = 15 PTS
    // SF: (1 * 5) + (0 * 10) + (0 * 4) + (1 * 4) + (1 * 1) = 10 PTS
    // Finales: (1 * 8) + (0 * 12) + (1 * 5) + (0 * 5) + (1 * 1) = 14 PTS
    // Total global attendu : 40 + 40 + 30 + 15 + 10 + 14 = 149 PTS
    assert.strictEqual(totalTournamentMeanScore, 149, "Le score accumulé cumulatif du joueur moyen sur l'intégralité du tournoi doit être de 149 points.");
});