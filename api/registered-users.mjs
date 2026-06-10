// api/registered-users.js
export default async function handler(req, res) {
  // Gestion des permissions CORS pour votre front Angular (GitHub Pages)  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const DIRECTUS_URL = process.env.DIRECTUS_URL;
  const DIRECTUS_ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
  const DIRECTUS_USER_ROLE_ID = process.env.DIRECTUS_USER_ROLE_ID;

  try {
    const response = await fetch(`${DIRECTUS_URL}/users?filter[role]=${DIRECTUS_USER_ROLE_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIRECTUS_ADMIN_TOKEN}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const userCount = data.data ? data.data.length : 0;
    return res.status(200).json({ success: true, count: userCount });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur interne du serveur', details: error.message });
  }
}
