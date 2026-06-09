import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) {
    return;
  }

  try {
    const gameData = await readJsonFile('game-rules-data.json');
    const initialData = gameData.elements; // Assuming 'elements' is the array to filter

    const { status, data } = applyFiltersAndSelect(initialData, request.query, 'nom');

    if (status === 404 && data.error === 'No elements match the provided filters.') {
      // Special handling for game-rules if no filters and no select, return full gameData
      const { select, ...filters } = request.query;
      if (Object.keys(filters).length === 0 && !select) {
        return response.status(200).json(gameData);
      }
    }
    
    return response.status(status).json(data);

  } catch (error) {
    console.error("Erreur lors de la lecture du fichier de règles :", error);
    return response.status(500).json({ error: "Erreur interne du serveur lors de la récupération des données." });
  }
}