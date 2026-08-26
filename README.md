# Encodr — Fullstack Take-Home

Thanks for taking the time! This is a small **media transcoding dashboard**. You'll build a flow where
a signed-in user creates an encode **job** from a media URL, starts a **transcode run**, watches its
**progress stream in live**, and sees the **output renditions** when it finishes.

The full brief — requirements, the API contract, and what we look for — is in **`BRIEF.md`** in this
repo. Read it first for the full requirements; this README documents the completed implementation.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run   # run the Vitest test suite
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Requires **Node 20+**. **Demo login:** `demo@encodr.dev` / `password123`.

The application is implemented as a small end-to-end encode workflow. It uses in-memory storage, so
restarting the server clears all jobs and runs.

## Implemented workflow

The signed-in user can:

- Create and list encode jobs from an HTTP(S) source URL.
- Start a run from a job detail page.
- Watch authenticated live progress through an SSE stream.
- See stage, percentage, streaming log messages, and terminal errors.
- Retry failed runs and view output renditions after completion.

The URL `https://cdn.example.com/videos/corrupt.mp4` is a deterministic failure fixture for testing
the error and retry path.

## Design decisions

### Authentication

The demo server issues short-lived access tokens and longer-lived refresh tokens. Tokens are signed
HMAC payloads containing the user, token type, and expiry. This keeps the implementation small and
does not require an additional JWT dependency; the signing secret comes from `AUTH_SECRET` and has a
development fallback.

The client attaches the access token to API requests. When a request receives `401`, the client makes
one silent refresh request, retries the original request once, and dispatches a logout event if the
refresh fails. A shared in-flight refresh promise prevents concurrent expired requests from causing
a refresh stampede.

### SSE progress

The browser uses `@microsoft/fetch-event-source` instead of native `EventSource` so the access token
can be sent in the `Authorization` header. The server emits snapshots from the same time-based state
machine used by the run API. `AbortController` cleanup closes the stream when the run changes or the
detail page unmounts.

### Validation and state

`createJobSchema` is shared by React Hook Form and the jobs Route Handler, keeping client and server
rules aligned. The server returns field-level `422` errors, which the form maps back to `sourceUrl`
and `title`. Run progress is represented by explicit typed stages and derived from elapsed time,
which keeps the in-memory simulation deterministic and easy to test.

## Tests

The suite focuses on meaningful core behavior rather than exhaustive edge cases:

- Valid and invalid HTTP(S) source URL validation.
- Successful run progression to `COMPLETED`.
- Corrupt fixture progression to `FAILED`.
- Job creation returning field-level validation errors.
- SSE route authentication and event streaming.

Run the tests with:

```bash
npm run test:run
```

## Notes & ground rules

- State can live **in-memory** (a module-level `Map`) — no database needed. Restarting the dev server
  wiping data is fine.
- Keep the access-token TTL short (~60s) so your refresh path is actually exercised.
- AI tools are allowed, but you own every line — there's a follow-up interview where you'll explain and
  extend your own code. Local commit walkthroughs are available in `docs/`.
- If something's ambiguous, make a reasonable call, note it here, and move on.

Optional stretch ideas and future-work considerations remain documented in `BRIEF.md`; they are not
required for the core implementation.
