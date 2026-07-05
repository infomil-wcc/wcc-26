import { fetchWithBypass } from './utils.mjs';

const fetch = fetchWithBypass;

export async function loadDbPlayers(directusUrl, adminToken) {
    const res = await fetch(`${directusUrl}/items/wcc_players`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    });

    const data = await res.json();

    return (data?.data || []).map(p => ({
        id: p.id,
        player_name: p.player_name,
        country: p.country,
        aliases: p.aliases || []
    }));
}