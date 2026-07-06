export function resolveScorers(apiScorers, dbPlayers) {
    if (!Array.isArray(apiScorers) || !Array.isArray(dbPlayers)) return [];

    return apiScorers.map(api => matchSingle(api, dbPlayers));
}

// =========================
// SINGLE MATCH
// =========================
function matchSingle(apiRaw, dbPlayers) {
    const apiClean = cleanName(apiRaw);
    const apiParts = splitName(apiClean);

    let best = null;
    let bestScore = 0;

    for (const player of dbPlayers) {
        const score = scorePlayer(apiParts, player);

        if (score > bestScore) {
            bestScore = score;
            best = player;
        }
    }

    return {
        apiName: apiRaw,
        matchedPlayer: bestScore >= 0.55 ? best : null,
        confidence: bestScore
    };
}

// =========================
// SCORE PLAYER
// =========================
function scorePlayer(apiParts, player) {
    const variants = buildVariants(player);

    let best = 0;

    for (const variant of variants) {
        const dbParts = splitName(variant);
        const score = scoreParts(apiParts, dbParts);

        if (score > best) best = score;
    }

    return best;
}

// =========================
// CORE SCORING
// =========================
function scoreParts(api, db) {
    let score = 0;

    const apiFirst = api[0];
    const apiLast = api[api.length - 1];

    const dbFirst = db[0];
    const dbLast = db[db.length - 1];

    if (api.join(' ') === db.join(' ')) return 1;

    if (apiLast && dbLast && apiLast === dbLast) score += 0.6;

    if (apiFirst && dbFirst && apiFirst === dbFirst) score += 0.3;

    if (apiFirst === dbLast && apiLast === dbFirst) score += 0.85;

    if (isInitialMatch(apiFirst, dbFirst)) score += 0.25;

    score += tokenSimilarity(api.join(' '), db.join(' ')) * 0.4;

    return Math.min(score, 1);
}

// =========================
// VARIANTS
// =========================
function buildVariants(player) {
    const base = cleanName(player.player_name);
    const parts = splitName(base);

    const set = new Set();

    set.add(base);

    if (parts.length > 1) {
        set.add([...parts].reverse().join(' '));
        set.add(`${parts[0]} ${parts[1][0]}`);
    }

    for (const a of player.aliases || []) {
        set.add(cleanName(a));
    }

    return [...set];
}

// =========================
// HELPERS
// =========================
function cleanName(name) {
    return (name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\d+/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/['".]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitName(name) {
    return name.split(' ').filter(Boolean);
}

function isInitialMatch(a, b) {
    if (!a || !b) return false;

    return (
        (a.length === 1 && b.startsWith(a)) ||
        (b.length === 1 && a.startsWith(b))
    );
}

function tokenSimilarity(a, b) {
    const aSet = new Set(a.split(' '));
    const bSet = new Set(b.split(' '));

    const intersection = [...aSet].filter(x => bSet.has(x)).length;
    const union = new Set([...aSet, ...bSet]).size;

    return union === 0 ? 0 : intersection / union;
}