import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(request, response) {
  // Gestion du mécanisme CORS (Preflight request)
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // 1. Lecture directe du fichier JSON dans le sous-dossier /data
    const jsonDirectory = path.join(process.cwd(), 'data');
    const fileContents = await fs.readFile(jsonDirectory + '/FIFA_SquadLists.json', 'utf8');
    const data = JSON.parse(fileContents);
    
    const allSquadsData = data.squads || [];

    // 2. Extraction du paramètre spécial 'select' et des filtres
    const { select, ...filters } = request.query;
    const filterKeys = Object.keys(filters);

    // Si aucun filtre n'est fourni, on part sur l'ensemble des équipes
    let result = allSquadsData;

    // 3. Application des filtres sur les propriétés de l'équipe (ex: country ou country_code)
    if (filterKeys.length > 0) {
      result = allSquadsData.filter(squad => {
        return filterKeys.every(key => {
          if (squad[key] === undefined) return false;
          if (typeof squad[key] === 'string') {
            return squad[key].toLowerCase() === filters[key].toLowerCase();
          }
          return squad[key] == filters[key];
        });
      });
    }

    // Si aucune équipe ne correspond aux filtres
    if (result.length === 0) {
      return response.status(404).json({ error: 'No squads match the provided filters.' });
    }

    // 4. Extraction dynamique via le paramètre 'select'
    if (select) {
      // Si le filtre a ciblé une seule équipe, retourne la propriété directement
      if (result.length === 1) {
        return response.status(200).json(result[0][select] !== undefined ? result[0][select] : { error: `Property '${select}' not found.` });
      }
      // Si plusieurs équipes correspondent, mappe pour retourner un tableau d'objets ciblé
      return response.status(200).json(
        result.map(squad => ({
          country: squad.country,
          country_code: squad.country_code,
          [select]: squad[select]
        }))
      );
    }

    // Par défaut, si aucune requête spécifique, retourne l'ensemble filtré (ou tout)
    return response.status(200).json(result);

  } catch (error) {
    // Gestion d'erreur si le fichier est introuvable ou mal formé
    return response.status(500).json({ error: 'Failed to read squad data file.', details: error.message });
  }
}