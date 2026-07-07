import { fetchWithBypass } from './utils.mjs';
const fetch = fetchWithBypass;

import { loadDbPlayers } from './player-loader.mjs';
import { resolveScorers } from './scorer-matcher.mjs';

const DRY_RUN = true; // Change to false to execute PATCH updates

export async function migrateScorerNames({
    directusUrl,
    adminToken,
    dryRun = true
}) {

    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
    };

    console.log("Loading players...");

    const dbPlayers = await loadDbPlayers(
        directusUrl,
        adminToken
    );

    console.log(`Loaded ${dbPlayers.length} players.`);


    console.log("Loading matches...");

    const response = await fetch(
        `${directusUrl}/items/matches/88`,
        {
            headers
        }
    );

    if (!response.ok) {
        throw new Error("Unable to load matches.");
    }

    const json = await response.json();

    const matches = [json.data];

    console.log(`Loaded ${matches.length} matches.`);


    let updated = 0;

    const unmatched = [];
    const matchedResults = [];
    const changedMatches = [];
    const debug = [];

    for (const match of matches) {

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


                console.log("\n==============================");
                console.log(`DRY RUN - MATCH ${match.id}`);
                console.log("==============================");


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

                console.error(
                    `✗ Failed updating match ${match.id}`
                );

            }

        } else {

            console.log(
                `No changes needed for match ${match.id}`
            );

        }

    }
    console.log("\n==============================");

    if (dryRun) {

        console.log(
            "DRY RUN COMPLETE - No data was modified."
        );

    } else {

        console.log(
            `MIGRATION COMPLETE - ${updated} matches updated.`
        );
    }

    if (unmatched.length > 0) {

        console.log("\nUNMATCHED PLAYERS:");
        console.table(unmatched);
    }

    return {
        totalMatches: matches.length,
        updated,
        changedMatchesCount: changedMatches.length,
        changedMatches,
        matchedCount: matchedResults.length,
        matchedResults,
        unmatchedCount: unmatched.length,
        unmatched,
        dryRun,
        debug

    };

}