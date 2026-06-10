import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) {
    return;
  }

  try {
    // 1. Keep the original file name unless intentionally changed
    const gameData = await readJsonFile('game-rules-data.json'); 
    
    const { select, ...filters } = request.query;
    const filterKeys = Object.keys(filters);

    // 2. Fix the Fallback: Check early if we just need to return the whole file
    if (filterKeys.length === 0 && !select) {
      return response.status(200).json(gameData);
    }

    // 3. Pass 'nom' as the default mapping key to match French data structures
    const { status, data } = applyFiltersAndSelect(gameData.elements, request.query, 'nom');
    
    return response.status(status).json(data);

  } catch (error) {
    console.error("Erreur lors de la lecture du fichier de règles :", error);
    return response.status(500).json({ error: "Erreur interne du serveur lors de la récupération des données." });
  }
}