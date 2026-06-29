import { fetchWithBypass } from './utils.mjs'; // S'assurer que le chemin d'accès est correct par rapport à votre arborescence

/**
 * Analyse une prédiction (création ou modification) pour détecter si elle a été soumise après le coup d'envoi.
 * @param {Object} payload - Le payload envoyé par le Webhook Directus (contient généralement 'event', 'collection', 'payload' et/ou 'keys')
 */
export async function checkPredictionValidity(payload) {
    const directusUrl = process.env.DIRECTUS_URL || 'https://euro.omediainteractive.net/imleuro';
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

    // 1. Extraction des données de la prédiction selon la structure du webhook Directus
    // Directus fournit la donnée modifiée ou créée dans payload.payload ou directement dans le body
    const predictionData = payload.payload || payload;
    const predictionId = payload.key || predictionData.id;
    const gameId = predictionData.game_id;

    if (!gameId || !predictionId) {
        return { status: 'skipped', message: 'Payload incomplet : game_id ou id de prédiction manquant.' };
    }

    try {
        // 2. Récupération de la date de création/modification de la prédiction
        // Si Directus ne fournit pas 'date_updated' ou 'date_created', on utilise l'heure système actuelle (heure de réception du webhook)
        const predictionTimestampStr = predictionData.date_updated || predictionData.date_created;
        const predictionTime = predictionTimestampStr ? new Date(predictionTimestampStr) : new Date();

        // 3. Récupération des détails du match pour obtenir l'heure réelle du coup d'envoi
        const matchUrl = `${directusUrl}/items/matches/${gameId}`;
        const matchRes = await fetchWithBypass(matchUrl, {
            headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
        });

        if (!matchRes.ok) {
            throw new Error(`Impossible de récupérer le match avec l'ID ${gameId} (Status: ${matchRes.status})`);
        }

        const matchResult = await matchRes.json();
        const matchTimeStr = matchResult.data?.date || matchResult.data?.kickoff_time;

        if (!matchTimeStr) {
            throw new Error(`Configuration de la date du match manquante pour le match ${gameId}.`);
        }

        const matchTime = new Date(matchTimeStr);

        // 4. Algorithme de détection de fraude
        // Si l'heure de la prédiction dépasse l'heure du coup d'envoi, il y a fraude
        if (predictionTime >= matchTime) {
            console.warn(`🚨 Fraude détectée ! Prédiction ${predictionId} soumise le ${predictionTime.toISOString()} pour un match ayant débuté le ${matchTime.toISOString()}.`);

            // 5. Rétroaction : Mise à jour de la ligne dans Directus pour marquer la fraude
            // On passe 'is_fraud' à true (et optionnellement on force les points à 0 ou on bloque l'affichage)
            const updateUrl = `${directusUrl}/items/pronostiques/${predictionId}`;
            const updateRes = await fetchWithBypass(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
                },
                body: JSON.stringify({
                    is_fraud: true
                    // Vous pouvez aussi forcer ici : fulltime_point: 0, winner_point: 0, etc.
                })
            });

            if (!updateRes.ok) {
                const errorText = await updateRes.text();
                throw new Error(`Échec de la mise à jour du statut fraude dans Directus : ${errorText}`);
            }

            return { 
                status: 'fraud_detected', 
                message: `La prédiction ${predictionId} a été marquée comme frauduleuse.` 
            };
        }

        return { 
            status: 'valid', 
            message: `La prédiction ${predictionId} est valide (reçue avant le coup d'envoi).` 
        };

    } catch (error) {
        console.error(`❌ Erreur dans le module fraud-detection pour la prédiction ${predictionId} :`, error.message);
        throw error;
    }
}