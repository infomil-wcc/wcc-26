import { fetchWithBypass } from './utils.mjs';
const fetch = fetchWithBypass;

import { loadDbPlayers } from './player-loader.mjs';
import { resolveScorers } from './scorer-matcher.mjs';

const DRY_RUN = true; // Change to false to execute PATCH updates

export async function migrateScorerNames({
    directusUrl,
    adminToken,
    dryRun = false,
    minMatchId = null,
    onProgress = null
}) {

    const logs = [];
    const log = (msg) => {
        logs.push(msg);
        if (onProgress) onProgress(msg);
    };

    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        log(msg);
        originalLog(...args);
    };
    console.error = (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        log('[ERROR] ' + msg);
        originalError(...args);
    };

    try {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
        };

    log(`🚀 Starting scorer names migration (Dry Run: ${dryRun})`);

    const dbPlayers = await loadDbPlayers(
        directusUrl,
        adminToken
    );

    log(`✅ Fetched ${dbPlayers.length} players`);


    log("Loading matches...");

    const response = await fetch(
        `${directusUrl}/items/matches?limit=-1`,
        {
            headers
        }
    );

    if (!response.ok) {
        throw new Error("Unable to load matches.");
    }

    const { data: matches } = await response.json();
    const filteredMatches = minMatchId !== null
        ? matches.filter(match => match.id >= Number(minMatchId))
        : matches;

    log(`✅ Fetched ${filteredMatches.length} valid matches`);


    let updated = 0;

    const unmatched = [];
    const matchedResults = [];
    const changedMatches = [];
    const debug = [];

    for (const match of filteredMatches) {

        debug.push({
            matchId: match.id,
            hasScorers: !!match.scorers,
            scorersType: typeof match.scorers,
            scorersValue: match.scorers
        });

        if (!match.scorers) {
            continue;
        }

        let scorers;

        try {

            scorers = Array.isArray(match.scorers)
                ? match.scorers
                : JSON.parse(match.scorers);

            debug.push({
                matchId: match.id,
                parsedScorersCount: scorers.length,
                parsedScorers: scorers
            });

        } catch (err) {

            console.error(
                `Cannot parse scorers for match ${match.id}`,
                err
            );

            continue;
        }

        const resolved = resolveScorers(
            scorers,
            dbPlayers
        );

        debug.push({
            matchId: match.id,
            resolved
        });

        const updatedScorers = scorers.map((scorer, index) => {

            const result = resolved[index];


            if (!result?.matchedPlayer) {

                unmatched.push({
                    matchId: match.id,
                    player: scorer.player?.name
                });


                return {
                    ...scorer,
                    player: {
                        ...scorer.player,
                        name: `NOT FOUND: ${scorer.player?.name}`
                    }
                };
            }

            const oldName = scorer.player?.name;
            const newName = result.matchedPlayer.player_name;

            matchedResults.push({
                matchId: match.id,
                original: oldName,
                matched: newName,
                confidence: Number(result.confidence.toFixed(2))
            });

            return {
                ...scorer,
                player: {
                    ...scorer.player,
                    name: newName
                }
            };

        });

        // Check if at least one scorer name changed
        const hasChanges = scorers.some((oldScorer, index) =>
            oldScorer.player?.name !== updatedScorers[index].player?.name
        );

        if (dryRun) {


            if (hasChanges) {

                changedMatches.push(match.id);


                log(`[Match ${match.id}] (DRY RUN) Would update ${match.scorers?.length || 0} scorers`);

                scorers.forEach((oldScorer, index) => {

                    const newScorer = updatedScorers[index];


                    if (
                        oldScorer.player?.name !==
                        newScorer.player?.name
                    ) {

                        console.log(
                            `${oldScorer.player?.name} ---> ${newScorer.player?.name}`
                        );

                    }

                });

            }

        } else if (hasChanges) {


            const patchResponse = await fetch(
                `${directusUrl}/items/matches/${match.id}`,
                {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        scorers: updatedScorers
                    })
                }
            );

            if (patchResponse.ok) {

                updated++;

                changedMatches.push(match.id);

                console.log(
                    `✓ Updated match ${match.id}`
                );

            } else {
                log(`[Match ${match.id}] ❌ Failed updating: Status ${updateRes.status}`);
            }

        } else {
            log(`No changes needed for match ${match.id}`);
        }

    }
    log(`\n🎉 Migration completed!`);
    log(`Total Matches Processed: ${filteredMatches.length}`);
    log(`Matches Updated: ${updated}`);

    if (unmatched.length > 0) {
        log(`[Matches] ⚠️ Some players still NOT FOUND: ${unmatched.length}`);
        unmatched.forEach(u => {
            log(`  - Match ${u.matchId}: ${u.player}`);
        });
    }

    return {
        totalMatches: filteredMatches.length,
        updated,
        changedMatchesCount: changedMatches.length,
        changedMatches,
        matchedCount: matchedResults.length,
        matchedResults,
        unmatchedCount: unmatched.length,
        unmatched,
        dryRun,
        debug,
        logs
    };

    } finally {
        console.log = originalLog;
        console.error = originalError;
    }
}