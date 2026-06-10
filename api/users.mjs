export default async function handler(req, res) {
  // No need for CORS headers or OPTIONS checks here. 
  // The cors() middleware in server.mjs handles it globally.

  if (req.method === 'GET') {
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

  } else if (req.method === 'POST') {
    const { email, password, first_name, last_name } = req.body;

    // Validation basique
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const DIRECTUS_URL = process.env.DIRECTUS_URL;
    const DIRECTUS_ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN; 
    
    try {
      const response = await fetch(`${DIRECTUS_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DIRECTUS_ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          email,
          password,
          first_name,
          last_name,
          status: 'active',
          role: process.env.DIRECTUS_USER_ROLE_ID
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      // Post to registration_ranking endpoint
      const registrationRankingUrl = `${DIRECTUS_URL}/items/registration_ranking`;
      try {
        await fetch(registrationRankingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DIRECTUS_ADMIN_TOKEN}`
          },
          body: JSON.stringify({
            trigramme: first_name,
            status: 'published'
          })
        });
      } catch (rankingError) {
        console.error('Error posting to registration_ranking:', rankingError);
      }

      return res.status(201).json({ success: true, user: data.data });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur interne du serveur', details: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
}