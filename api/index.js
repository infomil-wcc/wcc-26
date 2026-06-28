import { AutoRouter } from 'itty-router';
import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';
import { teamNameMap } from './mappings.mjs';

// 1. Initialisation du routeur centralisé pour l'API Infomil
const router = AutoRouter({ base: '/api' });

// ==========================================================================
// MIDDLEWARE GLOBAL : AJOUT DU BLOC TRY / CATCH MANQUANT
// ==========================================================================
router.all('*', async (request, response) => {
    try {
        // Gestion systématique des permissions pré-vol CORS
        if (handleCors(request, response)) {
            return response.end();
        }
    } catch (corsError) {
        console.error("❌ Échec critique lors de l'exécution du Middleware CORS :", corsError.message);
        return response.status(500).json({
            error: "Erreur d'initialisation de la passerelle API.",
            details: corsError.message
        });
    }
});

// ----------------------------------------------------------------------
// ROUTE 1 : RECOUVREMENT DES TEAMS & SQUADS (FUSIONNÉ)
// ----------------------------------------------------------------------
router.get('/teams-and-squads', async (request, response) => {
    const { type, ...queryParams } = request.query;

    try {
        if (type === 'squads') {
            const data = await readJsonFile('squads-data.json');
            const allSquadsData = data.squads || [];
            const { status, data: resultData } = applyFiltersAndSelect(allSquadsData, queryParams, 'country');
            return response.status(status).json(resultData);
        }

        if (type === 'teams') {
            const allTeamsData = await readJsonFile('teams-data.json');
            const { status, data } = applyFiltersAndSelect(allTeamsData, queryParams, 'name');

            if (status === 404 && data.error === 'No elements match the provided filters.') {
                const { select, ...filters } = queryParams;
                if (Object.keys(filters).length === 0 && !select) {
                    return response.status(200).json(allTeamsData);
                }
            }
            return response.status(status).json(data);
        }

        return response.status(400).json({ error: "Paramètre 'type' invalide (?type=teams ou ?type=squads)" });
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de la récupération des équipes/effectifs.", details: error.message });
    }
});

// ----------------------------------------------------------------------
// ROUTE 2 : RÈGLES DU JEU DYNAMIQUES (GAME RULES)
// ----------------------------------------------------------------------
router.get('/game-rules', async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    try {
        const gameData = await readJsonFile('game-rules-data.json');
        let rulesMatrix = [];
        let matchesList = [];

        try {
            const [rulesRes, matchesRes] = await Promise.all([
                fetch(`${directusUrl}/items/game_scoring_rules?limit=-1`, { headers: { 'Authorization': `Bearer ${adminToken}` } }),
                fetch(`${directusUrl}/items/matches?limit=-1`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
            ]);

            if (rulesRes.ok) rulesMatrix = (await rulesRes.json()).data || [];
            if (matchesRes.ok) matchesList = (await matchesRes.json()).data || [];
        } catch (apiErr) {
            console.error("⚠️ Erreur récupération Directus (utilisation des fallbacks) :", apiErr.message);
        }

        gameData.elements = gameData.elements.map(element => {
            if (element.id === 'jeu_pronostics') {
                const targetPhases = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

                const getScoringRuleValue = (phaseName, fieldName) => {
                    const targetClean = phaseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                    const row = rulesMatrix.find(r => {
                        const dbType = String(r.game_type || '').toLowerCase().trim();
                        const dbPhaseClean = String(r.phase || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                        return (dbType === 'pronostics' || dbType === 'match_prediction') && dbPhaseClean === targetClean;
                    });
                    return (!row || !fieldName || row[fieldName] === undefined) ? 0 : Number(row[fieldName]);
                };

                const matchCounts = targetPhases.map(phase => {
                    if (phase === 'Final') return (matchesList.filter(m => m.phase === 'Final' || m.phase === 'Third Place').length) || 2;
                    if (phase === 'Semi-finals') return (matchesList.filter(m => m.phase === 'Semi-finals').length) || 2;
                    return (matchesList.filter(m => m.phase === phase).length) || { 'Group Stage': 72, 'Round of 32': 16, 'Round of 16': 8, 'Quarter-finals': 4 }[phase] || 0;
                });

                const getDynamicCellPoints = (phaseName, ruleField, matchFlagField) => {
                    const matchesInPhase = matchesList.filter(m => m.phase === phaseName);
                    if (matchesInPhase.length === 0 || ruleField === 'winner_draw_points' || ruleField === 'consolation_points') {
                        return getScoringRuleValue(phaseName, ruleField);
                    }
                    return matchesInPhase.some(m => m[matchFlagField] === true) ? getScoringRuleValue(phaseName, ruleField) : 0;
                };

                const maxPointsPerMatch = targetPhases.map(phase => {
                    return getDynamicCellPoints(phase, 'winner_draw_points', null) +
                        getDynamicCellPoints(phase, 'fulltime_exact_points', 'fulltime') +
                        getDynamicCellPoints(phase, 'halftime_exact_points', 'halftime') +
                        getDynamicCellPoints(phase, 'scorer_points', 'scorer');
                });

                const totalPointsPossibleRow = matchCounts.map((count, idx) => count * maxPointsPerMatch[idx]);
                const formatCell = (val, prefix = "") => (!val || val === 0) ? "-" : (prefix ? `${prefix}${val}` : val);

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
                element.bareme_points_detaille.total_points_competition = totalPointsPossibleRow.reduce((sum, val) => sum + val, 0);
            }

            if (element.id === 'jeu_bracket') {
                const getBracketVal = (phaseName, fieldName = 'winner_draw_points') => {
                    const targetClean = phaseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                    const row = rulesMatrix.find(r => r.game_type === 'bracket' && r.phase.trim().toLowerCase() === targetClean);
                    return row ? Number(row[fieldName] || 0) : 0;
                };

                // 1. Extract values safely into cleanly named constants
                const round32 = getBracketVal('Round of 32', 'winner_draw_points');
                const round16 = getBracketVal('Round of 16', 'winner_draw_points');
                const quarter = getBracketVal('Quarter-finals', 'winner_draw_points');
                const sfBonus = getBracketVal('Semi-finals', 'qualification_bonus_points');
                const fBonus = getBracketVal('Final', 'champion_bonus_points');

                // 2. Assign properties using quotes for properties starting with digits
                element.bareme_points = {
                    "32eme_de_finale": round32,
                    "16eme_de_finale": round16,
                    "8eme_de_finale": quarter,
                    "demi_finale": sfBonus,
                    "finale": fBonus
                };
                element.bonus_equipe_finale = sfBonus;

                // 3. Clean math calculation using your constants
                element.maximum_possible = (16 * round32) + (8 * round16) + (4 * quarter) + (2 * sfBonus) + fBonus;
            }
            return element;
        });

        const { select, ...filters } = request.query;
        if (Object.keys(filters).length === 0 && !select) return response.status(200).json(gameData);

        const { status, data } = applyFiltersAndSelect(gameData.elements, request.query, 'nom');
        return response.status(status).json(data);
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de la génération des règles." });
    }
});

// ----------------------------------------------------------------------
// ROUTE 3 : COMPOSITION DES ÉQUIPES (LINEUPS)
// ----------------------------------------------------------------------
router.get('/lineups', async (request, response) => {
    const { team_a, team_b } = request.query;
    if (!team_a || !team_b) return response.status(400).json({ error: 'Missing team_a or team_b parameters.' });

    const normalize = (name) => {
        if (!name) return '';
        const trimmed = name.trim().toLowerCase();
        for (const [ext, db] of Object.entries(teamNameMap)) {
            if (ext.toLowerCase() === trimmed || db.toLowerCase() === trimmed) return ext.toLowerCase();
        }
        return trimmed;
    };

    const normA = normalize(team_a);
    const normB = normalize(team_b);

    if ((normA === 'argentina' && normB === 'austria') || (normA === 'austria' && normB === 'argentina')) {
        const isReversed = (normA === 'austria');
        const mockArgentina = { name: "Argentina", formation: "4-3-3", lineup: [], bench: [] };
        const mockAustria = { name: "Austria", formation: "4-2-3-1", lineup: [], bench: [] };
        return response.status(200).json({ matchId: 43, homeTeam: isReversed ? mockAustria : mockArgentina, awayTeam: isReversed ? mockArgentina : mockAustria });
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) return response.status(500).json({ error: 'Missing FOOTBALL_DATA_API_KEY env.' });

    try {
        const apiRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', { headers: { 'X-Auth-Token': apiKey } });
        const matches = (await apiRes.json()).matches || [];

        const targetMatch = matches.find(m => {
            const homeNorm = normalize(m.homeTeam?.name);
            const awayNorm = normalize(m.awayTeam?.name);
            return (homeNorm === normA && awayNorm === normB) || (homeNorm === normB && awayNorm === normA);
        });

        if (!targetMatch) return response.status(404).json({ error: `Match introuvable` });

        const detailsRes = await fetch(`https://api.football-data.org/v4/matches/${targetMatch.id}`, { headers: { 'X-Auth-Token': apiKey } });
        const matchDetails = await detailsRes.json();

        return response.status(200).json({
            matchId: targetMatch.id,
            homeTeam: { name: matchDetails.homeTeam?.name, formation: matchDetails.homeTeam?.formation || '4-3-3', lineup: matchDetails.homeTeam?.lineup || [], bench: matchDetails.homeTeam?.bench || [] },
            awayTeam: { name: matchDetails.awayTeam?.name, formation: matchDetails.awayTeam?.formation || '4-3-3', lineup: matchDetails.awayTeam?.lineup || [], bench: matchDetails.awayTeam?.bench || [] }
        });
    } catch (error) {
        return response.status(500).json({ error: 'Échec de la récupération des compositions.' });
    }
});

// ----------------------------------------------------------------------
// ROUTE 4 : COMPTE DES UTILISATEURS (REGISTERED USERS)
// ----------------------------------------------------------------------
router.get('/registered-users', async (request, response) => {
    try {
        const resUsers = await fetch(`${process.env.DIRECTUS_URL}/users?filter[role]=${process.env.DIRECTUS_USER_ROLE_ID}`, {
            headers: { 'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` }
        });
        const data = await resUsers.json();
        return response.status(200).json({ success: true, count: data.data ? data.data.length : 0 });
    } catch (error) {
        return response.status(500).json({ error: 'Erreur lors du comptage utilisateur.' });
    }
});

// ----------------------------------------------------------------------
// ROUTE 5 : INSCRIPTION DE NOUVEAUX UTILISATEURS (POST /api/users)
// ----------------------------------------------------------------------
router.post('/users', async (request, response) => {
    const { email, password, first_name, last_name } = request.body;
    if (!email || !password) return response.status(400).json({ error: 'Email et mot de passe requis' });

    try {
        const resDb = await fetch(`${process.env.DIRECTUS_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` },
            body: JSON.stringify({ email, password, first_name, last_name, status: 'active', role: process.env.DIRECTUS_USER_ROLE_ID })
        });
        const data = await resDb.json();
        if (!resDb.ok) return response.status(resDb.status).json(data);

        try {
            await fetch(`${process.env.DIRECTUS_URL}/items/registration_ranking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` },
                body: JSON.stringify({ trigramme: first_name, status: 'published' })
            });
        } catch (e) { console.error(e); }

        return response.status(201).json({ success: true, user: data.data });
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de l'enregistrement." });
    }
});

// 3. Export du point d'entrée requis pour Vercel Serverless
export default async function handler(request, response) {
    return router.handle(request, response);
}