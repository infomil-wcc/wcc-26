// api/create-user.js
export default async function handler(req, res) {
  // Gestion des permissions CORS pour votre front Angular (GitHub Pages)  
res.setHeader('Access-Control-Allow-Origin', '*'); // Remplacez * par votre URL GitHub Pages en prod  
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { email, password, first_name, last_name } = req.body;

  // Validation basique
if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const DIRECTUS_URL = process.env.DIRECTUS_URL;
  const DIRECTUS_ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN; 
  // Note : Le rôle par défaut des utilisateurs créés doit être configuré dans Directus
try {
    const response = await fetch(`${DIRECTUS_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIRECTUS_ADMIN_TOKEN}`// Clé cachée côté serveur 
      },
      body: JSON.stringify({
        email,
        password,
        first_name,
        last_name,
        status: 'active',
        role: process.env.DIRECTUS_USER_ROLE_ID // Optionnel : ID du rôle "Membre/Client"      
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(201).json({ success: true, user: data.data });
  } catch (error) {
    return res.status(500).json({ error: 'Erreur interne du serveur', details: error.message });
  }
}
