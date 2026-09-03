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

## Architecture

The application is organized as a small backend-for-frontend:

```text
React UI
  ↓
TanStack Query / React Hook Form
  ↓
Client API wrapper
  ↓
Next.js Route Handlers
  ↓
In-memory job and run store
```

Shared TypeScript types and Zod schemas are used across the client and server to keep API responses
and validation rules consistent.

## Run lifecycle

Each encode run follows a deterministic, time-based state machine:

```text
QUEUED → DOWNLOADING → PROBING → TRANSCODING → PACKAGING → COMPLETED
                                                ↘ FAILED
```

Normal runs complete after approximately 32 seconds. The corrupt fixture fails after approximately
16 seconds. Progress is represented as one global percentage from `0` to `100` and never moves
backward when the run changes stages.

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

## Error behavior

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON request body. |
| `401` | Missing, invalid, or expired authentication. |
| `404` | Job or run does not exist. |
| `422` | Valid JSON that fails schema validation. |

Job validation errors use a field-level response so the form can display the message beside the
correct input:

```json
{
  "detail": "Validation failed",
  "fieldErrors": {
    "sourceUrl": ["Enter a valid URL"],
    "title": ["Keep the title under 80 characters"]
  }
}
```

## Environment variables

The application runs without manual configuration by using a development fallback secret. An
explicit local secret can be provided in `.env.local`:

```env
ENCODR_AUTH_SECRET=replace-with-a-local-secret
```

The secret signs and verifies the mocked access and refresh tokens. It should not be committed.

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

Authentication is implemented as a realistic mocked flow using the single demo user defined by the
take-home. Successful login returns a short-lived access token and a longer-lived refresh token. All
jobs and runs routes validate the access token and return `401` for unauthenticated requests.

Tokens use a small HMAC-signed payload containing the user ID, token type, and expiry. This keeps the
implementation self-contained without adding a JWT dependency or external identity provider. The
client attaches the access token to requests, performs one silent refresh after a `401`, retries the
original request once, and logs the user out if refresh fails.

This is intentionally suitable for the exercise rather than production authentication. A production
system would use secure HTTP-only cookies or a dedicated identity provider, refresh-token rotation,
server-side revocation, and stronger operational secret management.


## Tests

The repository contains 26 focused tests across ten test files. They cover the core contract rather
than every possible edge case:

| Test file | Coverage |
| --- | --- |
| `auth.test.ts` | Usable demo access tokens and rejection of unknown-user token issuance. |
| `events-route.test.ts` | `401` without authentication and the initial authenticated SSE snapshot. |
| `auth-routes.test.ts` | Login validation, invalid credentials, and refresh success/failure. |
| `protected-routes.test.ts` | `401` protection for every jobs and runs API route. |
| `client-api.test.ts` | Access-token attachment, one refresh/retry, and logout after refresh failure. |
| `jobs-route.test.ts` | `422` response with field-level errors for invalid job data. |
| `jobs-form.test.tsx` | React Testing Library coverage for mapping server errors to form fields. |
| `runs-route.test.ts` | Run creation, missing-job handling, and current run snapshots. |
| `schemas.test.ts` | Valid HTTP(S) URLs and rejection of invalid, FTP, and pathless URLs. |
| `store.test.ts` | Successful completion, corrupt-source failure, and monotonic progress. |

These tests intentionally prioritize the meaningful application path. Full browser-level workflows,
SSE reconnect/resume, persistence tests, and exhaustive API error matrices are outside the scope of
this small take-home.

Run the tests with:

```bash
npm run test:run
npm run typecheck
npm run build
```

Or run the test and typecheck checks together:

```bash
npm run check
```

For a manual workflow check, run `npm run dev`, sign in, create a normal job, and open it to watch
the roughly 32-second successful run. Use the corrupt fixture above to verify the roughly 16-second
failure and retry path.

### Manual verification checklist

1. Open `/signin` and sign in with the demo credentials.
2. Create a job using a valid HTTP(S) URL.
3. Open the job and start an encode run.
4. Confirm live SSE stage, percentage, and log updates.
5. Wait for `COMPLETED` and confirm duration, renditions, and warnings.
6. Create a job using the corrupt fixture URL.
7. Confirm the run reaches `FAILED` and displays an error.
8. Select `Retry encode` and confirm a new run starts.
9. Sign out and confirm dashboard access redirects to `/signin`.

## Future improvements

With more time, I would add a Playwright happy-path test, SSE reconnect/resume after transient
network failures, persistent storage instead of in-memory Maps, and secure HTTP-only cookies with
refresh-token rotation for production authentication.

## Trade-offs and limitations

This implementation intentionally uses mocked authentication and in-memory storage because the brief
does not require a real identity provider or database. Restarting the server clears all jobs and runs.

SSE was chosen because the workflow requires server-to-client progress updates without the additional
complexity of WebSockets. The client uses `fetch-event-source` so the access token can be sent in an
Authorization header.

The test suite focuses on the core workflow, API boundaries, authentication recovery, validation, and
run state machine. Full browser automation, persistence, SSE resume, and exhaustive error matrices
are outside the take-home scope.

## Notes & ground rules

- State can live **in-memory** (a module-level `Map`) — no database needed. Restarting the dev server
  wiping data is fine.
- Keep the access-token TTL short (~60s) so your refresh path is actually exercised.
- AI tools are allowed, but you own every line — there's a follow-up interview where you'll explain and
  extend your own code. Local commit walkthroughs are available in `docs/`.
- If something's ambiguous, make a reasonable call, note it here, and move on.

Optional stretch ideas and future-work considerations remain documented in `BRIEF.md`; they are not
required for the core implementation.
