import { AutoRouter } from 'itty-router';
import { handleCors, applyFiltersAndSelect } from './libs/utils.mjs';
import { generateGameRules } from './lib    s/gameRulesHelper.mjs';
import { getMatchLineups } from './libs/lineupsHelper.mjs';
import { getRegisteredUserCount, registerNewUser } from './libs/usersHelper.mjs';
import { getTeamsOrSquads } from './libs/teamsSquadsHelper.mjs';

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
// ROUTE 1A : GESTION DES SQUADS (Legacy Endpoint)
// ----------------------------------------------------------------------
router.get('/squads', async (request, response) => {
    try {
        // Force the type to 'squads' and forward all query string filters
        const { status, data } = await getTeamsOrSquads('squads', request.query);
        return response.status(status).json(data);
    } catch (error) {
        console.error("Erreur lors de la récupération des effectifs (squads) :", error);
        return response.status(500).json({
            error: "Erreur lors de la récupération des effectifs.",
            details: error.message
        });
    }
});

// ----------------------------------------------------------------------
// ROUTE 1B : GESTION DES TEAMS (Legacy Endpoint)
// ----------------------------------------------------------------------
router.get('/teams', async (request, response) => {
    try {
        // Force the type to 'teams' and forward all query string filters
        const { status, data } = await getTeamsOrSquads('teams', request.query);
        return response.status(status).json(data);
    } catch (error) {
        console.error("Erreur lors de la récupération des équipes (teams) :", error);
        return response.status(500).json({
            error: "Erreur lors de la récupération des équipes.",
            details: error.message
        });
    }
});

// ----------------------------------------------------------------------
// ROUTE 2 : RÈGLES DU JEU DYNAMIQUES (GAME RULES)
// ----------------------------------------------------------------------
router.get('/game-rules', async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    try {
        // Execute helper tracking calculations cleanly 
        const gameData = await generateGameRules(fetchWithBypass, directusUrl, adminToken);

        const { select, ...filters } = request.query;
        if (Object.keys(filters).length === 0 && !select) {
            return response.status(200).json(gameData);
        }

        const { status, data } = applyFiltersAndSelect(gameData.elements, request.query, 'nom');
        return response.status(status).json(data);

    } catch (error) {
        console.error("Erreur lors du routage des règles :", error);
        return response.status(500).json({ error: "Erreur lors de la génération des règles." });
    }
});

// ----------------------------------------------------------------------
// ROUTE 3 : COMPOSITION DES ÉQUIPES (LINEUPS)
// ----------------------------------------------------------------------
router.get('/lineups', async (request, response) => {
    const { team_a, team_b } = request.query;
    if (!team_a || !team_b) {
        return response.status(400).json({ error: 'Missing team_a or team_b parameters.' });
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    try {
        const result = await getMatchLineups(team_a, team_b, apiKey);

        if (!result) {
            return response.status(404).json({ error: `Match not found for ${team_a} vs ${team_b}` });
        }

        return response.status(200).json(result);

    } catch (error) {
        if (error.message === 'MISSING_API_KEY') {
            return response.status(500).json({ error: 'Missing FOOTBALL_DATA_API_KEY environment variable.' });
        }

        console.error('Error fetching lineups:', error);
        return response.status(500).json({ error: 'Failed to fetch lineup details.', details: error.message });
    }
});

// ----------------------------------------------------------------------
// ROUTE 5 : INSCRIPTION DE NOUVEAUX UTILISATEURS (POST /api/users)
// ----------------------------------------------------------------------
router.post('/users', async (request, response) => {
    const { email, password, first_name, last_name } = request.body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const config = {
        directusUrl: process.env.DIRECTUS_URL,
        adminToken: process.env.DIRECTUS_ADMIN_TOKEN,
        roleId: process.env.DIRECTUS_USER_ROLE_ID
    };

    try {
        const createdUser = await registerNewUser({ email, password, first_name, last_name }, config);
        return response.status(201).json({ success: true, user: createdUser });
    } catch (error) {
        if (error.message === 'MISSING_CONFIGURATION') {
            return response.status(500).json({ error: 'Configuration environment variables are missing.' });
        }

        console.error("Erreur d'inscription utilisateur :", error.message);
        return response.status(error.status || 500).json(error.details || {
            error: "Erreur lors de l'enregistrement.",
            details: error.message
        });
    }
});

// ----------------------------------------------------------------------
// ROUTE 6 : COMPTE DES UTILISATEURS (REGISTERED USERS)
// ----------------------------------------------------------------------
router.get('/registered-users', async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL;
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    const roleId = process.env.DIRECTUS_USER_ROLE_ID;

    try {
        const userCount = await getRegisteredUserCount(directusUrl, adminToken, roleId);
        return response.status(200).json({ success: true, count: userCount });
    } catch (error) {
        if (error.message === 'MISSING_CONFIGURATION') {
            return response.status(500).json({ error: 'Configuration environment variables are missing.' });
        }

        console.error('Error fetching registered user count:', error.message);
        return response.status(error.status || 500).json({
            error: 'Erreur lors du comptage utilisateur.',
            details: error.message
        });
    }
});

// 3. Export du point d'entrée requis pour Vercel Serverless
export default async function handler(request, response) {
    return router.handle(request, response);
}