# PING approved implementation plan — 2026-10-16

Authority: David's planning brief and the approved in-chat plan. Fictional-data prototype only; no production disaster deployment.

## Tasks

- [x] 1. Database-backed foundation and deployment configuration (local path verified).
- [x] 2. Authentication, scoped access, every-login preferences and expiry.
- [x] 3. Registration, manual matching, private reply, wrong-person and safeguarding.
- [x] 4. Assistance queues, explicit shelter consent, idempotent mutations.
- [x] 5. Isolated reviewer workspaces and complete fictional scenario.
- [x] 6. Accessible responsive UI, map/list and failure states.
- [x] 7. API, real PostgreSQL and browser privacy verification; independent final AI review and fixes.
- [x] 8. README, screenshots, logs and deployment handoff.
- [ ] External release: public GitHub repository, Render/Neon deployment, signed-out public verification, actual URLs in README. Awaiting hosting access and concrete publication review.

## Fixed decisions

React/Vite, Express, TypeScript, PostgreSQL, Drizzle SQL migrations, Zod, Leaflet 1.9.4. One same-origin web service on Render; managed PostgreSQL on Neon. One reply per request, with optional separate one-time shelter consent. All private data workspace-scoped. Local shelter profiles only. Explicit case grants for approved-response access. Unknown-age and child cases cannot use ordinary disclosure. Shared idle expiry 2 minutes (90-second warning), personal 15 minutes (14-minute warning), staff 10 minutes (9-minute warning); absolute limits 30 minutes / 8 hours / 8 hours. Every resident login asks device and persistent assistance preference independently.

## Acceptance

Complete Shelter A → Shelter B → resident preview → requester reply cycle with no recipient metadata leakage. Verify wrong-person, silent decline, safeguarding, logout/back navigation, throttling, cross-ID authorization, assistance races, duplicate retries, durable persistence, reviewer isolation, and map failure fallback. Never claim an unverified public URL or tests not executed.

## Deployment authorization

Build locally while David studies. Hosting credentials are pending; no paid services. Prepare concrete repository/deployment artifacts before any publication confirmation required by the working agreement.
