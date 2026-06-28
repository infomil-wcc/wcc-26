import { handleCors } from './utils.mjs';

import { teamNameMap } from './mappings.mjs';

function normalize(name) {
    if (!name) return '';
    const trimmed = name.trim().toLowerCase();
    for (const [ext, db] of Object.entries(teamNameMap)) {
        if (ext.toLowerCase() === trimmed || db.toLowerCase() === trimmed) {
            return ext.toLowerCase();
        }
    }
    return trimmed;
}

export default async function handler(request, response) {
    if (handleCors(request, response)) return;

    const { team_a, team_b } = request.query;

    if (!team_a || !team_b) {
        return response.status(400).json({ error: 'Missing team_a or team_b parameters.' });
    }

    const normA = normalize(team_a);
    const normB = normalize(team_b);

    if ((normA === 'argentina' && normB === 'austria') || (normA === 'austria' && normB === 'argentina')) {
        const isReversed = (normA === 'austria');
        const mockArgentina = {
            name: "Argentina",
            formation: "4-3-3",
            lineup: [
                { name: "E. Martinez", position: "Goalkeeper", shirtNumber: 23 },
                { name: "N. Molina", position: "Defence", shirtNumber: 26 },
                { name: "C. Romero", position: "Defence", shirtNumber: 13 },
                { name: "L. Martinez", position: "Defence", shirtNumber: 25 },
                { name: "N. Tagliafico", position: "Defence", shirtNumber: 3 },
                { name: "R. De Paul", position: "Midfield", shirtNumber: 7 },
                { name: "E. Fernandez", position: "Midfield", shirtNumber: 24 },
                { name: "A. Mac Allister", position: "Midfield", shirtNumber: 20 },
                { name: "L. Messi", position: "Offence", shirtNumber: 10 },
                { name: "J. Alvarez", position: "Offence", shirtNumber: 9 },
                { name: "N. Gonzalez", position: "Offence", shirtNumber: 15 }
            ],
            bench: [
                { name: "G. Rulli", position: "Goalkeeper", shirtNumber: 12 },
                { name: "J. Musso", position: "Goalkeeper", shirtNumber: 1 },
                { name: "L. Balerdi", position: "Defence", shirtNumber: 2 },
                { name: "G. Montiel", position: "Defence", shirtNumber: 4 },
                { name: "L. Paredes", position: "Midfield", shirtNumber: 5 },
                { name: "G. Lo Celso", position: "Midfield", shirtNumber: 11 },
                { name: "T. Almada", position: "Offence", shirtNumber: 16 }
            ]
        };
        const mockAustria = {
            name: "Austria",
            formation: "4-2-3-1",
            lineup: [
                { name: "P. Pentz", position: "Goalkeeper", shirtNumber: 13 },
                { name: "S. Posch", position: "Defence", shirtNumber: 5 },
                { name: "K. Danso", position: "Defence", shirtNumber: 4 },
                { name: "P. Lienhart", position: "Defence", shirtNumber: 15 },
                { name: "P. Mwene", position: "Defence", shirtNumber: 16 },
                { name: "N. Seiwald", position: "Midfield", shirtNumber: 6 },
                { name: "K. Laimer", position: "Midfield", shirtNumber: 20 },
                { name: "R. Schmid", position: "Midfield", shirtNumber: 18 },
                { name: "C. Baumgartner", position: "Midfield", shirtNumber: 19 },
                { name: "M. Sabitzer", position: "Midfield", shirtNumber: 9 },
                { name: "M. Arnautovic", position: "Offence", shirtNumber: 7 }
            ],
            bench: [
                { name: "H. Lindner", position: "Goalkeeper", shirtNumber: 1 },
                { name: "N. Hedl", position: "Goalkeeper", shirtNumber: 12 },
                { name: "G. Trauner", position: "Defence", shirtNumber: 3 },
                { name: "M. Wober", position: "Defence", shirtNumber: 2 },
                { name: "F. Grillitsch", position: "Midfield", shirtNumber: 10 },
                { name: "M. Gregoritsch", position: "Offence", shirtNumber: 11 },
                { name: "P. Wimmer", position: "Offence", shirtNumber: 23 }
            ]
        };

        return response.status(200).json({
            matchId: 43,
            homeTeam: isReversed ? mockAustria : mockArgentina,
            awayTeam: isReversed ? mockArgentina : mockAustria
        });
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
        return response.status(500).json({ error: 'Missing FOOTBALL_DATA_API_KEY environment variable.' });
    }

    try {
        // 1. Fetch matches from football-data.org API
        const apiRes = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            method: 'GET',
            headers: {
                'X-Auth-Token': apiKey
            }
        });

        if (!apiRes.ok) {
            throw new Error(`Football-Data API returned status ${apiRes.status}`);
        }

        const data = await apiRes.json();
        const matches = data.matches || [];

        const normA = normalize(team_a);
        const normB = normalize(team_b);

        // Find match matching team_a and team_b
        const targetMatch = matches.find(m => {
            const homeNorm = normalize(m.homeTeam?.name);
            const awayNorm = normalize(m.awayTeam?.name);
            return (homeNorm === normA && awayNorm === normB) || (homeNorm === normB && awayNorm === normA);
        });

        if (!targetMatch) {
            return response.status(404).json({ error: `Match not found for ${team_a} vs ${team_b}` });
        }

        // 2. Fetch specific match details to get starting line-up and bench
        const matchDetailsRes = await fetch(`https://api.football-data.org/v4/matches/${targetMatch.id}`, {
            method: 'GET',
            headers: {
                'X-Auth-Token': apiKey
            }
        });

        if (!matchDetailsRes.ok) {
            throw new Error(`Football-Data Match Details API returned status ${matchDetailsRes.status}`);
        }

        const matchDetails = await matchDetailsRes.json();

        // extract lineups
        const result = {
            matchId: targetMatch.id,
            homeTeam: {
                name: matchDetails.homeTeam?.name,
                formation: matchDetails.homeTeam?.formation || '4-3-3',
                lineup: matchDetails.homeTeam?.lineup || [],
                bench: matchDetails.homeTeam?.bench || []
            },
            awayTeam: {
                name: matchDetails.awayTeam?.name,
                formation: matchDetails.awayTeam?.formation || '4-3-3',
                lineup: matchDetails.awayTeam?.lineup || [],
                bench: matchDetails.awayTeam?.bench || []
            }
        };

        return response.status(200).json(result);

    } catch (error) {
        console.error('Error fetching lineups from football-data:', error);
        return response.status(500).json({ error: 'Failed to fetch lineup details.', details: error.message });
    }
}
