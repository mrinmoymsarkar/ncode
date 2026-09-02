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

## Live demo

The feature-branch deployment is available at:

**[Open the Encodr live demo](https://ncode-liart.vercel.app/)**

Use the sign-in page to access the demo and test the job creation, live progress, failure, retry, and
completed-results flows.

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

## API behavior

All jobs and runs endpoints require an access token in the `Authorization: Bearer <token>` header.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/login` | Validates credentials and returns access token, refresh token, and user. |
| `POST /api/auth/refresh` | Validates a refresh token and returns a new access token. |
| `GET /api/jobs` | Returns the current in-memory job list. |
| `POST /api/jobs` | Validates `sourceUrl` and optional `title`, returning field-level errors with `422` when invalid. |
| `GET /api/jobs/:id` | Returns one job or `404`. |
| `POST /api/runs` | Validates `jobId`, starts a run, and returns its run ID. |
| `GET /api/runs/:id` | Returns the latest run snapshot or `404`. |
| `GET /api/runs/:id/events` | Streams authenticated run snapshots over Server-Sent Events. |

Invalid or missing credentials return `401`. Invalid request bodies return `400` or `422`, depending on
whether the JSON body is malformed or fails schema validation. Jobs and runs are intentionally stored
in memory, so a server restart clears them.

## Design decisions

### Authentication

The demo server issues short-lived access tokens and longer-lived refresh tokens. Tokens are signed
HMAC payloads containing the user, token type, and expiry. This keeps the implementation small and
does not require an additional JWT dependency; the signing secret comes from `ENCODR_AUTH_SECRET` and
has a development fallback. Token issuance also verifies that the requested user exists, so the
server never creates tokens that cannot be used successfully.

The client attaches the access token to API requests. When a request receives `401`, the client makes
one silent refresh request, retries the original request once, and dispatches a logout event if the
refresh fails. A shared in-flight refresh promise prevents concurrent expired requests from causing
a refresh stampede.

### SSE progress

The browser uses `@microsoft/fetch-event-source` instead of native `EventSource` so the access token
can be sent in the `Authorization` header. The server emits snapshots from the same time-based state
machine used by the run API. Progress can update every second, while the client deduplicates adjacent
identical log messages so the log shows meaningful stage changes rather than repeated polling ticks.
`AbortController` cleanup closes the stream when the run changes or the detail page unmounts.

### Validation and state

`createJobSchema` is shared by React Hook Form and the jobs Route Handler, keeping client and server
rules aligned. The server returns field-level `422` errors, which the form maps back to `sourceUrl`
and `title`. Run progress is represented by explicit typed stages and derived from elapsed time. The
percentage is global across the complete run (`0 → 5 → 25 → 35 → 82 → 99 → 100`), so it never jumps
backward when the stage changes. This keeps the in-memory simulation deterministic and easy to test.

### Why authentication is implemented

Authentication is required by the brief, not an optional enhancement. The API must issue short-lived
access tokens and refresh tokens, protect every jobs/runs route with `401` responses, and let the
client silently refresh an expired access token once. This implementation uses a small HMAC-signed
token format because the brief asks for realistic mocked auth without requiring a real identity
provider. It is intentionally not production authentication; a real application would use an
identity provider, secure cookies or a dedicated token library, refresh-token rotation, and
server-side revocation.

## Tests

The repository contains 11 focused tests across six test files. They cover the core contract rather
than every possible edge case:

| Test file | Coverage |
| --- | --- |
| `auth.test.ts` | Usable demo access tokens and rejection of unknown-user token issuance. |
| `events-route.test.ts` | `401` without authentication and the initial authenticated SSE snapshot. |
| `jobs-route.test.ts` | `422` response with field-level errors for invalid job data. |
| `schemas.test.ts` | Valid HTTP(S) URLs and rejection of invalid, FTP, and pathless URLs. |
| `store.test.ts` | Successful completion, corrupt-source failure, and monotonic progress. |
| `example.test.ts` | Basic verification that the Vitest harness and shared stage helpers work. |

These tests intentionally prioritize the meaningful application path. Browser-level interaction tests,
refresh-expiry integration tests, persistence tests, and exhaustive API error matrices are outside the
scope of this small take-home.

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
