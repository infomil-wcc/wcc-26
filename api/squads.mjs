import { handleCors, readJsonFile, applyFiltersAndSelect } from './utils.mjs';

export default async function handler(request, response) {
  if (handleCors(request, response)) {
    return;
  }

  try {
    const data = await readJsonFile('squads-data.json');
    const allSquadsData = data.squads || [];

    const { status, data: resultData } = applyFiltersAndSelect(allSquadsData, request.query, 'country');
    
    return response.status(status).json(resultData);

  } catch (error) {
    return response.status(500).json({ error: 'Failed to read squad data file.', details: error.message });
  }
}