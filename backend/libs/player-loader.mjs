export async function loadDbPlayers(directusUrl, adminToken) {
    const res = await fetch(`${directusUrl}/items/players`, {
        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });

    if (!res.ok) {
        console.error("Failed to load players");
        return [];
    }

    const data = await res.json();

    const players = data?.data || [];

    return players.map(p => ({
        id: p.id,
        player_name: p.player_name,
        country: p.country
    }));
}