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
        `${directusUrl}/items/matches?limit=-1&fields=id,scorers`,
        {
            headers
        }
    );

    if (!response.ok) {
        throw new Error("Unable to load matches.");
    }

    const { data: matches } = await response.json();

    console.log(`Loaded ${matches.length} matches.`);


    let updated = 0;

    const unmatched = [];


    for (const match of matches) {

        if (!match.scorers) {
            continue;
        }


        let scorers;

        try {

            scorers = Array.isArray(match.scorers)
                ? match.scorers
                : JSON.parse(match.scorers);

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


            return {
                ...scorer,
                player: {
                    ...scorer.player,
                    name: result.matchedPlayer.player_name
                }
            };

        });



        if (dryRun) {

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


        } else {


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

                console.log(
                    `✓ Updated match ${match.id}`
                );

            } else {

                console.error(
                    `✗ Failed updating match ${match.id}`
                );

            }

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

}