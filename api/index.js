import { Router } from 'itty-router';
import { handleCors, applyFiltersAndSelect, fetchWithBypass } from '../backend/libs/utils.mjs';
import { generateGameRules } from '../backend/libs/gameRulesHelper.mjs';
import { getMatchLineups } from '../backend/libs/lineupsHelper.mjs';
import { getRegisteredUserCount, registerNewUser } from '../backend/libs/usersHelper.mjs';
import { getTeamsOrSquads } from '../backend/libs/teamsSquadsHelper.mjs';
import { migrateScorerNames } from '../backend/libs/scorers-migration.mjs';

// 1. Initialisation du routeur centralisé pour l'API Infomil
const router = Router();

// ==========================================================================
// MIDDLEWARE GLOBAL : AJOUT DU BLOC TRY / CATCH MANQUANT
// ==========================================================================

// Helper to set standard Vercel Cache-Control headers safely
const setCacheControl = (request, response, maxAge = 60, staleWhileRevalidate = 120, forcePublic = false) => {
    // Only cache GET or HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.setHeader('Cache-Control', 'private, no-cache, no-store');
        return;
    }

    // Check if the frontend sent an authorization token
    const hasAuth = request.headers.authorization && request.headers.authorization.length > 0;

    if (hasAuth && !forcePublic) {
        response.setHeader('Cache-Control', 'private, no-cache, no-store');
    } else {
        response.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
    }
};

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
router.get('/api/squads', async (request, response) => {
    try {
        setCacheControl(request, response, 60, 120, true);
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
router.get('/api/teams', async (request, response) => {
    try {
        setCacheControl(request, response, 60, 120, true);
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
router.get('/api/game-rules', async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    try {
        setCacheControl(request, response, 86400, 300, true);
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
// ROUTE 2B : SERVEUR DE TEMPS CENTRALISÉ (TIME API PROXY)
// ----------------------------------------------------------------------
router.get('/api/time/current/zone', async (request, response) => {
    const { timeZone } = request.query;
    if (!timeZone) {
        return response.status(400).json({ error: 'Missing timeZone parameter.' });
    }

    const timeApiUrl = process.env.TIME_API_URL || 'https://timeapi.io';
    const targetUrl = `${timeApiUrl}/api/time/current/zone?timeZone=${timeZone}`;

    try {
        const res = await fetchWithBypass(targetUrl);
        const data = await res.json();
        return response.status(res.status).json(data);
    } catch (error) {
        console.error('Error fetching time from TimeAPI:', error.message);
        const now = new Date();
        return response.status(200).json({
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            seconds: now.getSeconds(),
            milliSeconds: now.getMilliseconds(),
            dateTime: now.toISOString(),
            date: `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`,
            time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            timeZone: timeZone,
            dayOfWeek: now.toLocaleString('en-US', { weekday: 'long' }),
            dstActive: false
        });
    }
});

// ----------------------------------------------------------------------
// ROUTE 3 : COMPOSITION DES ÉQUIPES (LINEUPS)
// ----------------------------------------------------------------------
router.get('/api/lineups', async (request, response) => {
    const { team_a, team_b } = request.query;
    if (!team_a || !team_b) {
        return response.status(400).json({ error: 'Missing team_a or team_b parameters.' });
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    try {
        setCacheControl(request, response, 60, 120, true);
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
router.post('/api/users', async (request, response) => {
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
router.get('/api/registered-users', async (request, response) => {
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


// ----------------------------------------------------------------------
// ROUTE 7: VALIDATION ET INTERCEPTION DES PRONOSTICS
// ----------------------------------------------------------------------
const handleMatchPredictionValidation = async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    try {
        const allowedOrigins = [
            'http://localhost:4200',
            'https://euro.omediainteractive.net',
            'https://wcc-26.vercel.app'
        ];
        const origin = request.headers.origin || request.headers.Origin;
        
        // If it's a cross-origin request (has an origin header) and it's not in our explicit whitelist, reject it.
        if (origin && !allowedOrigins.includes(origin)) {
            return response.status(403).json({ error: "Forbidden: Cross-origin access to this endpoint is strictly disallowed." });
        }

        // Parse the body to extract game_id
        let body = request.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }

        const gameId = body.game_id;
        if (!gameId) {
            return response.status(400).json({ error: "Missing game_id in prediction payload." });
        }

        // 1. Fetch the match date/time details from Directus
        // Adjust the collection path ('/items/matches/') according to your actual Directus structure
        const matchUrl = `${directusUrl}/items/matches/${gameId}`;
        const matchRes = await fetchWithBypass(matchUrl, {
            headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
        });

        if (!matchRes.ok) {
            return response.status(404).json({ error: `Match with ID ${gameId} not found.` });
        }

        const matchData = await matchRes.json();
        // Assuming your match object contains a 'date' or 'kickoff_time' field in ISO format string (e.g. "2026-06-15T18:00:00Z")
        const matchTimeStr = matchData.data?.date || matchData.data?.kickoff_time;

        if (!matchTimeStr) {
            return response.status(500).json({ error: "Match baseline timing configuration is missing on the server." });
        }

        const matchTime = new Date(matchTimeStr);
        const currentTime = new Date(); // Use internal system server time synchronized with your Time API

        // 2. Core validation logic: If current time is past the match kick-off, lock predictions
        if (currentTime >= matchTime) {
            return response.status(400).json({
                error: "Prediction Refused",
                details: "Le match a déjà commencé ou est terminé. Les pronostics sont verrouillés."
            });
        }

        // 3. Strip game_id from PATCH/PUT requests to prevent Directus field-level permission errors
        if (request.method === 'PATCH' || request.method === 'PUT') {
            delete body.game_id;
            delete body.user;
            request.body = body; // Update the request body so proxyDirectus uses the stripped payload
        }

        // 4. If validation passes, hand over execution context to the standard Directus proxy handler
        return proxyDirectus(request, response);

    } catch (error) {
        console.error("Error during prediction validation middleware intercept:", error);
        return response.status(500).json({ error: "Internal validation failure.", details: error.message });
    }
};

// ----------------------------------------------------------------------
// ROUTE DIRECTUS PROXY CATCH-ALL FOR THIRD-PARTY CALLS
// ----------------------------------------------------------------------
const proxyDirectus = async (request, response) => {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const relativePath = url.pathname.replace(/^\/api/, '');
    const targetUrl = `${directusUrl}${relativePath}${url.search}`;

    // Manage cache control intelligently for proxy endpoints
    if (relativePath.startsWith('/assets') || relativePath.startsWith('/files')) {
        setCacheControl(request, response, 86400, 86400, true);
    } else if (relativePath.startsWith('/items/pronostiques') && request.headers.authorization) {
        // Authenticated pronostiques requests must never be cached — they are user-specific
        setCacheControl(request, response, 0, 0, false);
    } else {
        // Items endpoints or others - only cached if no auth token is passed from frontend
        setCacheControl(request, response, 60, 120, false);
    }

    try {
        const headers = {};
        for (const [k, v] of Object.entries(request.headers)) {
            if (!['host', 'connection', 'content-length', 'accept-encoding'].includes(k.toLowerCase())) {
                headers[k] = v;
            }
        }

        if (!headers.authorization && adminToken) {
            headers.authorization = `Bearer ${adminToken}`;
        }

        const fetchOptions = {
            method: request.method,
            headers: headers
        };

        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
            fetchOptions.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
        }

        const res = await fetchWithBypass(targetUrl, fetchOptions);

        const contentType = res.headers && res.headers['content-type'] ? res.headers['content-type'].toLowerCase() : '';
        if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('application/pdf') || contentType.startsWith('font/') || contentType.startsWith('audio/')) {
            const buf = await res.buffer();
            response.setHeader('Content-Type', contentType);
            return response.status(res.status).send(buf);
        }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        if (res.status >= 400) {
            console.error(`[proxyDirectus] ${request.method} ${targetUrl} -> ${res.status}`);
            console.error('[proxyDirectus] Request body:', typeof fetchOptions.body === 'string' ? fetchOptions.body : JSON.stringify(fetchOptions.body));
            console.error('[proxyDirectus] Response body:', JSON.stringify(data));
        }

        return response.status(res.status).json(data);
    } catch (error) {
        console.error(`Error proxying request to Directus (${targetUrl}):`, error);
        return response.status(500).json({ error: 'Failed to proxy request to Directus.', details: error.message });
    }
};

// ----------------------------------------------------------------------
// TEMP ROUTE: MIGRATE SCORERS
// ----------------------------------------------------------------------
router.get('/api/admin/migrate-scorers', async (request, response) => {

    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    try {

        // optional protection
        const secret = request.query.secret;

        if (secret !== process.env.SCORER_MIGRATION_SECRET) {
            return response.status(403).json({
                error: "Forbidden"
            });
        }

        const dryRun = request.query.dryRun !== 'false';

         const minMatchId = request.query.minMatchId
            ? Number(request.query.minMatchId)
            : null;

        const result = await migrateScorerNames({
            directusUrl,
            adminToken,
            dryRun,
            minMatchId
        });

        return response.status(200).json({
            success: true,
            dryRun,
            minMatchId,
            result
        });

    } catch (error) {
        console.error("Scorer migration failed:", error);

        return response.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Intercept both creations (POST) and updates (PATCH/PUT) for the collection
router.post('/api/items/pronostiques', handleMatchPredictionValidation);
router.patch('/api/items/pronostiques/*', handleMatchPredictionValidation);
router.put('/api/items/pronostiques/*', handleMatchPredictionValidation);
router.all('/api/items', proxyDirectus);
router.all('/api/items/*', proxyDirectus);
router.all('/api/auth', proxyDirectus);
router.all('/api/auth/*', proxyDirectus);
router.get('/api/users', proxyDirectus);
router.all('/api/users/*', proxyDirectus);
router.all('/api/files', proxyDirectus);
router.all('/api/files/*', proxyDirectus);
router.all('/api/assets', proxyDirectus);
router.all('/api/assets/*', proxyDirectus);
router.all('/api/mail', proxyDirectus);
router.all('/api/mail/*', proxyDirectus);

// 3. Export du point d'entrée requis pour Vercel Serverless
export default async function handler(request, response) {
    const host = request.headers.host || 'localhost';
    const absoluteUrl = request.url.startsWith('http://') || request.url.startsWith('https://')
        ? request.url
        : `http://${host}${request.url}`;

    const wrappedRequest = {
        url: absoluteUrl,
        method: request.method,
        headers: request.headers,
        body: request.body,
        query: request.query,
        params: request.params
    };

    return router.fetch(wrappedRequest, response);
}