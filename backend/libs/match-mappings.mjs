import { teamNameMap, phaseMap } from './mappings.mjs'; // Path changed to parent directory

export function getNormalizedTeamName(externalName) {
    if (!externalName) return null;
    const trimmedName = externalName.trim();
    return teamNameMap[trimmedName] || trimmedName;
}

export function getNormalizedPhase(apiType) {
    if (!apiType) return null;
    const lowerType = apiType.toLowerCase().trim();
    return phaseMap[lowerType] || lowerType;
}

export function getDbMatchUtcTime(dbDateStr) {
    if (!dbDateStr) return 0;
    const isoStr = dbDateStr.trim().replace(' ', 'T') + '+04:00';
    return new Date(isoStr).getTime();
}

export function getFdMatchUtcTime(utcDateStr) {
    if (!utcDateStr) return 0;
    return new Date(utcDateStr).getTime();
}

export function getWcGameApproxUtcTime(localDateStr) {
    if (!localDateStr) return 0;
    const [datePart, timePart] = localDateStr.split(' ');
    const [month, day, year] = datePart.split('/');
    const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00'}:00Z`;
    return new Date(isoStr).getTime();
}

export function parseScorersString(scorersStr, teamName) {
    // 1. If it's already an array of goal objects, return it directly
    if (Array.isArray(scorersStr)) {
        return scorersStr;
    }

    if (!scorersStr || scorersStr === 'null' || scorersStr === '') return [];
    
    let cleanStr = scorersStr.replace(/[“”]/g, '"');
    let arr = [];
    try {
        const parsed = JSON.parse(cleanStr);
        if (Array.isArray(parsed)) {
            arr = parsed;
        } else {
            const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
            if (matches) arr = matches.map(m => m.replace(/^"|"$/g, ''));
        }
    } catch (e) {
        const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
        if (matches) arr = matches.map(m => m.replace(/^"|"$/g, ''));
    }

    const events = [];
    for (const goalStr of arr) {
        if (typeof goalStr === 'object' && goalStr !== null) {
            events.push(goalStr);
            continue;
        }
        const regex = /^(.*?)\s+(\d+)'?(?:\+(\d+))?'?\s*(\((?:OG|p|CSC|PEN)\)|\[(?:OG|p|CSC|PEN)\])?$/i;
        const match = goalStr.trim().match(regex);
        if (match) {
            const playerName = match[1].trim();
            const elapsed = parseInt(match[2], 10);
            const extra = match[3] ? parseInt(match[3], 10) : null;
            let detail = 'Normal Goal';
            if (match[4]) {
                const detailLower = match[4].toLowerCase();
                if (detailLower.includes('og') || detailLower.includes('csc')) detail = 'Own Goal';
                else if (detailLower.includes('p') || detailLower.includes('pen')) detail = 'Penalty';
            }
            events.push({
                time: { elapsed, extra },
                team: { name: teamName },
                player: { name: playerName },
                detail
            });
        } else {
            events.push({
                time: { elapsed: 0, extra: null },
                team: { name: teamName },
                player: { name: goalStr.trim() },
                detail: 'Normal Goal'
            });
        }
    }
    return events;
}

export function parseScorersStringForRanking(scorersStr) {
    // 1. If it's an array of goal objects, map out the player names directly
    if (Array.isArray(scorersStr)) {
        return scorersStr
            .map(e => e?.player?.name || e?.scorer?.name || (typeof e === 'string' ? e : null))
            .filter(Boolean)
            .map(s => s.trim());
    }

    if (!scorersStr || scorersStr === 'null' || scorersStr === '') return [];
    
    let cleanStr = scorersStr.replace(/[“”]/g, '"');
    let arr = [];
    try {
        const parsed = JSON.parse(cleanStr);
        if (Array.isArray(parsed)) {
            arr = parsed.map(e => e.player?.name || e.scorer?.name).filter(Boolean);
        } else {
            const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
            if (matches) arr = matches.map(m => m.replace(/^"|"$/g, ''));
        }
    } catch (e) {
        const matches = cleanStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
        if (matches) arr = matches.map(m => m.replace(/^"|"$/g, ''));
    }
    return arr.map(s => s.trim());
}