# Backend Architecture

While the frontend is built entirely in Angular, the backend operations—such as match scheduling, ranking calculations, and database management—are powered by a combination of a custom Express Server, **Directus**, and **Upstash QStash**.

## Directus (Headless CMS & Database)

[Directus](https://directus.io/) acts as the central source of truth for the application.

- **Data Storage:** It houses all critical collections such as `matches`, `pronostiques` (user predictions), `game_scoring_rules`, and `bracket` data.
- **API Engine:** The Angular frontend communicates with Directus REST endpoints to fetch data or submit user predictions.
- **Privileged Access:** Backend scripts (like the ranking calculators) utilize a `DIRECTUS_ADMIN_TOKEN` to bypass standard permissions when recalculating points for all users after a match finishes.

## Upstash QStash (Serverless Scheduler)

[QStash](https://upstash.com/docs/qstash/overall/getstarted) by Upstash is utilized as a serverless message queue and CRON scheduler to automate the lifecycle of the tournament.

### How it works:
1. **Match Polling:** The system has an endpoint (`api/match-scheduler.mjs`) that is triggered periodically by QStash.
2. **Security:** The endpoint verifies the incoming webhook signature using `@upstash/qstash` to ensure the request is legitimately from the scheduler.
3. **Dynamic Scheduling:** After checking current match statuses, if matches are ongoing or have recently finished, the script calculates user rankings and auto-advances knockout brackets.
4. **Recursive Triggers:** It then calculates the exact kick-off time of the *next* upcoming match and uses the QStash Client (`qstashClient.publishJSON`) to dynamically schedule the next check exactly when that match concludes. 

This ensures server resources aren't wasted polling Directus when no games are actively being played.

## Custom Express API

Alongside Directus, the Angular Universal (SSR) server (`server.mjs`) acts as a middleware backend to securely serve the frontend and handle specific `/api` routes (like the aforementioned match scheduler endpoints).
