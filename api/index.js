import { AutoRouter } from 'itty-router';
import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';

// 1. Initialisation du routeur léger avec un préfixe global de route
const router = AutoRouter({ base: '/api' });

// 2. Middleware Global : Gestion systématique de CORS pour toutes les routes
router.all('*', (request, response) => {
    // Si handleCors retourne true, cela signifie qu'il a déjà répondu à une requête OPTIONS
    if (handleCors(request, response)) {
        return response.end();
    }
});

// ----------------------------------------------------------------------
// ROUTE : ÉQUIPES (TEAMS) -> GET /api/teams
// ----------------------------------------------------------------------
router.get('/teams', async (request, response) => {
    try {
        const allTeamsData = await readJsonFile('teams-data.json');

        // itty-router fournit request.query automatiquement
        const { status, data } = applyFiltersAndSelect(allTeamsData, request.query, 'name');

        if (status === 404 && data.error === 'No elements match the provided filters.') {
            const { select, ...filters } = request.query;
            if (Object.keys(filters).length === 0 && !select) {
                return response.status(200).json(allTeamsData);
            }
        }

        return response.status(status).json(data);
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de la récupération des équipes." });
    }
});

// ----------------------------------------------------------------------
// ROUTE : EFFECTIFS (SQUADS) -> GET /api/squads
// ----------------------------------------------------------------------
router.get('/squads', async (request, response) => {
    try {
        const data = await readJsonFile('squads-data.json');
        const allSquadsData = data.squads || [];

        const { status, data: resultData } = applyFiltersAndSelect(allSquadsData, request.query, 'country');
        return response.status(status).json(resultData);
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de la récupération des effectifs." });
    }
});

// ----------------------------------------------------------------------
// ROUTE : RÈGLES DU JEU (GAME RULES) -> GET /api/game-rules
// ----------------------------------------------------------------------
router.get('/game-rules', async (request, response) => {
    try {
        const gameData = await readJsonFile('game-rules-data.json');
        // Vous pouvez insérer ici votre logique de calcul dynamique ou d'hydratation si nécessaire
        return response.status(200).json(gameData);
    } catch (error) {
        return response.status(500).json({ error: "Erreur lors de la récupération des règles." });
    }
});

// 3. Export du Handler principal requis par Vercel
export default async function handler(request, response) {
    // On passe la requête native de Vercel au routeur itty-router
    return router.handle(request, response);
}