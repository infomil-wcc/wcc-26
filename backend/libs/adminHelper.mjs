import { fetchWithBypass } from './utils.mjs';

export async function forcePoints(username, points) {
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const directusUrl = process.env.DIRECTUS_URL;

  if (!adminToken || !directusUrl) {
    return { status: 500, data: { error: 'Missing environment variables' } };
  }

  if (!username || points === undefined) {
    return { status: 400, data: { error: 'Missing username or points' } };
  }

  try {
    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    // 1. Fetch the user's ID using case-insensitive local match
    const searchUrl = `${directusUrl}/items/pronostics_rankings?limit=-1`;
    const searchRes = await fetchWithBypass(searchUrl, { headers });
    const searchData = await searchRes.json();

    let patchRes;
    const existingRow = searchData.data ? searchData.data.find(r => r.key?.toLowerCase().trim() === username.toLowerCase().trim()) : null;

    if (!existingRow) {
      // User not found, create them
      const postUrl = `${directusUrl}/items/pronostics_rankings`;
      patchRes = await fetchWithBypass(postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: username, point: Number(points), rank: 9999 })
      });
    } else {
      const userId = existingRow.id;
      // 2. Patch the points
      const patchUrl = `${directusUrl}/items/pronostics_rankings/${userId}`;
      patchRes = await fetchWithBypass(patchUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ point: Number(points) })
      });
    }

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return { status: patchRes.status, data: { error: `Directus PATCH failed: ${errText}` } };
    }

    return { status: 200, data: { success: true, message: `Points forced for ${username}` } };
  } catch (err) {
    return { status: 500, data: { error: err.message } };
  }
}

export async function recalculateRanksOnly() {
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  const directusUrl = process.env.DIRECTUS_URL;

  if (!adminToken || !directusUrl) {
    return { status: 500, data: { error: 'Missing environment variables' } };
  }

  try {
    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    // 1. Fetch all current rankings
    const searchUrl = `${directusUrl}/items/pronostics_rankings?limit=-1`;
    const searchRes = await fetchWithBypass(searchUrl, { headers });
    const searchData = await searchRes.json();

    let rankings = searchData.data || [];

    // 2. Sort by points (descending), then alphabetically if tie
    rankings.sort((a, b) => Number(b.point) - Number(a.point) || a.key.localeCompare(b.key));

    // 3. Assign new ranks
    let rank = 1;
    let updates = [];

    for (let index = 0; index < rankings.length; index++) {
      const obj = rankings[index];
      if (index > 0 && Number(obj.point) !== Number(rankings[index - 1].point)) {
        rank = index + 1;
      }
      
      const newRank = rank;
      if (Number(obj.rank) !== newRank) {
        updates.push({ id: obj.id, key: obj.key, oldRank: obj.rank, newRank: newRank });
        // Prepare PATCH
        await fetchWithBypass(`${directusUrl}/items/pronostics_rankings/${obj.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ rank: newRank })
        });
      }
    }

    return { status: 200, data: { 
      success: true, 
      message: `Rank recalculation complete. ${updates.length} ranks updated.`,
      updates 
    } };
  } catch (err) {
    return { status: 500, data: { error: err.message } };
  }
}
