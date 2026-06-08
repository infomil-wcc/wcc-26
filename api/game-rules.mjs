import fs from 'fs';
import path from 'path';

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // Construction du chemin absolu vers le fichier data/rules.json
    const filePath = path.join(process.cwd(), 'data', 'rules.json');
    
    // Lecture du fichier de manière asynchrone
    const fileData = await fs.promises.readFile(filePath, 'utf8');
    
    // Parsing du contenu JSON
    const gameData = JSON.parse(fileData);

    // Extraction du paramètre 'select' et des filtres
    const { select, ...filters } = request.query;
    const filterKeys = Object.keys(filters);

    // Par défaut, on travaille sur la liste des éléments (jeux + dispositions)
    let result = gameData.elements;

    if (filterKeys.length > 0) {
      result = gameData.elements.filter(item => {
        return filterKeys.every(key => {
          if (item[key] === undefined) return false;
          if (typeof item[key] === 'string') {
            return item[key].toLowerCase() === filters[key].toLowerCase();
          }
          return item[key] == filters[key];
        });
      });
    }

    if (result.length === 0) {
      return response.status(404).json({ error: 'Aucun élément ne correspond aux filtres fournis.' });
    }

    // Si le paramètre 'select' est fourni
    if (select) {
      if (result.length === 1) {
        return response.status(200).json(result[0][select] || { error: `La propriété '${select}' n'existe pas.` });
      }
      return response.status(200).json(result.map(item => ({ nom: item.nom, [select]: item[select] })));
    }

    // Si aucun filtre ni select n'est demandé, on renvoie l'intégralité du JSON structuré
    if (filterKeys.length === 0 && !select) {
      return response.status(200).json(gameData);
    }

    return response.status(200).json(result);

  } catch (error) {
    console.error("Erreur lors de la lecture du fichier de règles :", error);
    return response.status(500).json({ error: "Erreur interne du serveur lors de la récupération des données." });
  }
}