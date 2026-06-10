import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) {
    return;
  }

  try {
    const allTeamsData = await readJsonFile('teams-data.json');
    const initialData = allTeamsData; // Assuming 'elements' is the array to filter

    const { status, data } = applyFiltersAndSelect(initialData, request.query, 'name');

    if (status === 404 && data.error === 'No elements match the provided filters.') {
      // Special handling for teams if no filters and no select, return full allTeamsData
      const { select, ...filters } = request.query;
      if (Object.keys(filters).length === 0 && !select) {
        return response.status(200).json(allTeamsData);
      }
    }

    return response.status(status).json(data);

  } catch (error) {
    console.error("Erreur lors de la lecture du fichier de équipes :", error);
    return response.status(500).json({ error: "Erreur interne du serveur lors de la récupération des données." });
  }
}