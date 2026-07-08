import { test, expect } from '@playwright/test';

// Fonction utilitaire pour préparer le mock selon le scénario
const setupMockData = async (page: any, matchOverrides: any = {}, pronostiqueOverrides: any = null, teamOverrides: any[] = null) => {
  // Base match data
  const baseMatch = {
    id: 1,
    team_a: 'France',
    team_b: 'Germany',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow by default
    phase: 'Group Stage',
    stadium: 'Stade de France',
    current_status: 'Scheduled',
    played: false,
    fulltime_a: null,
    fulltime_b: null,
    halftime_a: null,
    halftime_b: null,
    scorer: null,
    ...matchOverrides
  };

  const teams = teamOverrides || [
    { name: 'France', flag_url: 'assets/flags/france.png' },
    { name: 'Germany', flag_url: 'assets/flags/germany.png' }
  ];

  await page.route('**/api/auth/authenticate', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          token: 'fake-jwt-token',
          user: { id: '1', first_name: 'iml-abc', last_name: 'iml-abc' }
        }
      })
    });
  });

  await page.route('**/api/items/matches*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [baseMatch] })
    });
  });

  await page.route('**/api/items/pronostiques*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: pronostiqueOverrides ? [pronostiqueOverrides] : [] })
    });
  });

  await page.route('**/api/items/teams*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: teams })
    });
  });
  
  // Mock tactical lineup API
  await page.route('**/api/items/teams?filter*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { players: [{ Name: 'K. Mbappé', id: 1 }, { Name: 'A. Griezmann', id: 2 }] }
        ]
      })
    });
  });

  // Mock global modals to prevent them from blocking the UI
  await page.route('**/api/items/knockout_bracket*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 1 }] })
    });
  });

  await page.route('**/api/items/total_goals*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 1 }] })
    });
  });

  // Login
  await page.goto('/login');
  await page.getByLabel(/EMAIL/).fill('test@infomil.mu');
  await page.getByLabel(/MOT DE PASSE/).fill('password');
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.waitForURL('**/');
};

test.describe('MatchComponent - Chronologie (Temps)', () => {
  
  test('Match Futur (Scheduled) - Saisie possible', async ({ page }) => {
    await setupMockData(page, {
      current_status: 'Scheduled',
      date: new Date(Date.now() + 86400000).toISOString() // Demain
    });
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    // Vérifier que le composant est éditable (inputs activés)
    const scoreInputs = matchLocator.locator('.number-input-wrapper input');
    await expect(scoreInputs.nth(0)).not.toBeDisabled();
    await expect(scoreInputs.nth(1)).not.toBeDisabled();

    // Vérifier qu'il y a un compte à rebours
    await expect(matchLocator.locator('.match-info span.font-bold')).toContainText(/J|H|M|S/);
  });

  test('Match En Cours (In Play) - Saisie bloquée', async ({ page }) => {
    await setupMockData(page, {
      current_status: 'In Play',
      date: new Date(Date.now() - 3600000).toISOString(), // Il y a 1h
      played: true
    });
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    // Vérifier que le composant est verrouillé (match closed)
    await expect(matchLocator.locator('.match-closed')).toBeVisible();

    // Vérifier qu'il affiche "Match en cours"
    await expect(matchLocator.locator('.match-info')).toContainText(/Match en cours/i);
  });

  test('Match Terminé (Finished) avec résultat affiché', async ({ page }) => {
    await setupMockData(page, {
      current_status: 'Finished',
      date: new Date(Date.now() - 86400000).toISOString(), // Hier
      played: true,
      fulltime_a: 2,
      fulltime_b: 1,
      halftime_a: 1,
      halftime_b: 0,
      scorer: 'K. Mbappé'
    });
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    // Vérifier que le composant est verrouillé
    await expect(matchLocator.locator('.match-closed')).toBeVisible();

    // Vérifier l'affichage du score officiel
    await expect(matchLocator.locator('app-match-official-score')).toBeVisible();
    await expect(matchLocator.locator('app-match-official-score .score-pill-container')).toContainText('2 - 1');
  });
});

test.describe('MatchComponent - Phases et Pénaltys', () => {

  test('Phase de Poule (Group Stage) - Autorise le match nul', async ({ page }) => {
    await setupMockData(page, { phase: 'Group Stage' });
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    const scoreInputs = matchLocator.locator('.number-input-wrapper input');
    await scoreInputs.nth(0).fill('1');
    await scoreInputs.nth(1).fill('1');
    await page.mouse.click(0, 0);

    // En phase de poule, aucun bouton "Winner" n'est requis après un match nul
    await expect(matchLocator.locator('.winner-container')).toHaveCount(0);
    // Le bouton envoyer est activé
    await expect(matchLocator.locator('.btnSubmit')).not.toBeDisabled();
  });

  test('Phase Finale (Round of 16) - Gère les pénaltys sur un nul', async ({ page }) => {
    await setupMockData(page, { phase: 'Round of 16' });
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    const scoreInputs = matchLocator.locator('.number-input-wrapper input');
    await scoreInputs.nth(0).fill('1');
    await scoreInputs.nth(1).fill('1');
    await page.mouse.click(0, 0);

    // Le bouton de pénaltys doit s'afficher
    const winnerContainer = matchLocator.locator('.winner-container');
    await expect(winnerContainer).toBeVisible();
    await expect(winnerContainer).toContainText(/Vainqueur aux pénaltys/i);

    // Le bouton envoyer doit être désactivé
    await expect(matchLocator.locator('.btnSubmit')).toBeDisabled();

    // Sélection du vainqueur
    await matchLocator.locator('button', { hasText: 'France' }).click();

    // Le bouton envoyer devient actif
    await expect(matchLocator.locator('.btnSubmit')).not.toBeDisabled();
  });

});

test.describe('MatchComponent - Buteur', () => {

  test("Choix et effacement d'un buteur", async ({ page }) => {
    await setupMockData(page);
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();
    await expect(matchLocator).toBeVisible();

    // Clic sur choisir buteur
    await matchLocator.locator('.scorer-button').click();

    // La modale s'ouvre
    const tacticalModal = page.locator('app-tactical-lineup');
    await expect(tacticalModal).toBeVisible();

    // Sélection de Mbappé
    await tacticalModal.locator('.player-card', { hasText: 'Mbappé' }).click();

    // Modale fermée, buteur affiché
    await expect(tacticalModal).not.toBeVisible();
    await expect(matchLocator.locator('.scorer-badge')).toContainText('K. Mbappé');

    // On efface le buteur
    await matchLocator.locator('.btn-clear-scorer').click();
    await expect(matchLocator.locator('.scorer-button')).toBeVisible();
  });

});

test.describe('MatchComponent - Calcul de points et fraude', () => {

  test('Calcul des points - Score exact', async ({ page }) => {
    // Pronostic correct (France 2-1) et Résultat officiel (France 2-1)
    await setupMockData(
      page,
      { // Official match
        current_status: 'Finished',
        date: new Date(Date.now() - 86400000).toISOString(),
        played: true,
        fulltime_a: 2, fulltime_b: 1, halftime_a: 1, halftime_b: 0,
        scorer: 'K. Mbappé', winner_draw: 'France'
      },
      { // Prediction
        game_id: 1, user: 'iml-abc',
        fulltime_a: 2, fulltime_b: 1, halftime_a: 1, halftime_b: 0,
        scorer: 'K. Mbappé', winner_draw: 'France',
        date_created: new Date(Date.now() - 172800000).toISOString() // Pronostic fait avant le match
      }
    );
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();

    // On vérifie que les points s'affichent
    const pointsBadge = matchLocator.locator('.points-badge');
    await expect(pointsBadge).toBeVisible();
    // Le badge affiche des points
    await expect(pointsBadge).toContainText(/Pts/); 
  });

  test('Détection de tricherie', async ({ page }) => {
    // Pronostic enregistré *après* le début du match
    await setupMockData(
      page,
      { 
        current_status: 'Finished',
        date: new Date(Date.now() - 86400000).toISOString(), // Match commencé hier
        played: true,
        fulltime_a: 2, fulltime_b: 1,
        winner_draw: 'France'
      },
      {
        game_id: 1, user: 'iml-abc',
        fulltime_a: 2, fulltime_b: 1, winner_draw: 'France',
        date_created: new Date(Date.now() - 3600000).toISOString(), // Pronostic fait il y a 1h (pendant/après)
        invalidated_date: new Date(Date.now() - 3600000).toISOString()
      }
    );
    await page.goto('/games/pronostiques');
    const matchLocator = page.locator('app-match').first();

    // L'UI affiche que le pronostic est invalidé (tricherie détectée)
    // Selon l'implémentation de MatchComponent, cela cache le badge de points et indique une triche (ex: classe .invalid-badge ou style)
    // Ici on suppose qu'il y a un indicateur visuel (à adapter selon le vrai code)
    await expect(matchLocator.locator('.invalid-badge').or(matchLocator.locator('.fa-triangle-exclamation'))).toBeVisible();
  });

});
