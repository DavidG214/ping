# Verification evidence

## October 18, 2026 — release preparation

The source was published to `https://github.com/DavidG214/ping`. The first Linux CI run passed the build and API suite but failed one of 28 browser scenarios. Its trace exposed a login form remount during background session renewal: the route element read `window.location.search` without subscribing to route changes. The app now uses React Router's `useLocation`, and a controlled delayed-renewal regression reproduced the failure before the fix.

The local release rerun also exposed a cross-tab ordering race: the first lock notification initiated a session read before logout completed its cookie rotation. Lock notifications now only clear private state; a distinct session-ready notification refreshes public session metadata after rotation. The existing cross-tab test now holds logout and asserts there is no premature session read; it failed before the fix and passed afterward. The registration browser test was corrected to await the completed staff sign-out screen before navigating to resident login, instead of aborting the logout request with immediate page navigation. Build passed; 28 browser scenarios passed together, followed by the corrected registration scenario passing separately. The next CI run will verify all 29 together.

Returning to the local preview exposed a repeat-start defect in `scripts/local-db.ts`: it ran `initdb` even when the persistent cluster already existed. The failure was reproduced against the stopped local cluster. The helper now checks for `PG_VERSION` before initialization. Starting the corrected helper reused the existing PostgreSQL 18 cluster, brought both databases online and restored the browser home without resetting data. `npm run check` passed after this change. The API and browser totals below remain the earlier expanded-suite results; this release-preparation check does not represent a fresh full-suite run.

The staged publication files were checked for excluded environment/database/dependency folders and common credential patterns. No matches were found; this bounded check is not a comprehensive secret-scanning certification.

## October 18, 2026 — expanded feature review (latest)

After the tablet implementation checkpoint below, David requested broader feature testing, a whole-project review, a detailed README and a process handoff. The latest checks ran against the dedicated local `ping_test` database, sequentially:

| Check | Latest observed result |
|---|---|
| `npm test` | **24 API tests passed, 0 failed** |
| `npm run build` | **Passed**: TypeScript, Vite and bundled Express server |
| `npm run test:e2e` | **28 Chromium scenarios passed, 0 failed** |
| `npm audit --json` | **0 known vulnerabilities** across all reported severity levels |
| Whole-project AI review | Read-only review completed; two functional defects fixed, one safeguarding limitation explicitly retained/documented |
| Refreshed local preview | Chromium loaded the rebuilt home at `http://localhost:41938`; health returned `ok: true`, directory returned 3 desks, no page errors; refreshed `docs/screenshots/preview-live.png` |

New browser coverage: staff-created request through cross-shelter routing to the recipient; incoming assistance claim/release/presentation; approved-reply assistance and revocation of an open message; safeguarding acknowledgment and restricted resident view; failed staff-feed retry; independent assistance changes; and login in a second tab after cross-tab logout without reloading.

New API coverage: tampered/expired/wrong-action/wrong-resident signed previews; exact one-time shelter disclosure and current-presence requirement; assigned-role/workspace safeguarding acknowledgment; database-backed sessions across application recreation; and a shelter update arriving while an assistance reply is already claimed. Recreating an Express app against the same database is **not** a test of process/database restart recovery.

### Findings and dispositions

1. **Fixed: approved shelter update lost from assistance work.** A failing API test showed an old claim could be marked presented after new disclosure was approved. Separately approved shelter updates now invalidate open claims and requeue the task. The old presentation attempt fails, and a new claim retrieves the updated content.
2. **Fixed: stale CSRF after cross-tab logout.** A failing two-page Chromium test showed the receiving tab's normal login failed until a reload. Lock broadcasts now refresh public session/CSRF metadata while retaining a locked private view; a second broadcast follows successful logout cookie rotation.
3. **Known limitation: safeguarding referrals lack operational intake linkage.** The screen now displays the existing referral UUID so generic referrals can be distinguished. The API still returns only assigned reference/reason/acknowledgment; no person identity or intake link was added. A real safeguarding process cannot be completed from this panel alone. The earlier constraint to preserve API projections/permissions is retained. This finding is mitigated for reference visibility, **not resolved as a complete operational workflow**.

The initial new tests also contained incorrect fixture assumptions (a fictional address, a button's exact label, and the assumption that safeguarding staff lacked their existing local staff API permissions). Those tests were corrected against the actual fixtures and documented permission model; no corresponding production change is claimed.

All fresh automated checks passed. The review was performed by AI and is not a formal security certification. Actual iPad/Safari, Firefox, screen-reader, physical printing, load, database-process restart, public hosting, TLS/cookies and public CI remain unverified. No commit, push or publication occurred.

Deliverables: expanded `README.md`, paste-ready `docs/process-handoff.md`, updated AI/decision logs, and the executable tests. The previous checkpoint below remains as historical evidence.

## October 18, 2026 — shared-tablet implementation

Working copy: `C:/Users/guerr/Projects/ping-tablet`. The original `Projects/ping` source is preserved. All database-backed automated tests below used the dedicated local database named exactly `ping_test`; API and browser suites ran sequentially.

| Check | Observed result |
|---|---|
| Baseline | 14 API tests and 7 Chromium scenarios passed before implementation |
| Final API suite, `npm test` | **19 passed, 0 failed** |
| Final build, `npm run build` | **Passed**: TypeScript, Vite, esbuild |
| Final browser suite, `npm run test:e2e` | **22 passed, 0 failed** (59.2 seconds) |
| Local preview, `npm run preview:local` | Running on `http://localhost:41938`; Chromium loaded home, health returned `ok: true`, directory returned 3 desks, no page errors |
| Review | One fresh-context read-only AI review; two findings fixed with failing-then-passing regressions |
| Screenshots | Fresh desktop/mobile, 1024×768 landscape, 768×1024 portrait, 320px staff navigation, resident preview/confirmation and failed-map directory captures |

### Regression evidence

- Successful staff sign-in previously returned 429 on repeated valid logins. It now clears only its account counter. Failed account attempts and the IP limit still deny access.
- Claiming reply assistance previously exposed an account card to a fresh staff account without a case grant. Tests now check active claims and release, presentation, expiry and opt-out, competing staff, alternate card/request reads and request creation. Legitimate explicit case grants remain valid. No migration or historical-grant deletion was made.
- The old concurrent routing test could skip all assistance checks. Both candidate preferences are now set deterministically, and task counts are asserted.
- Failed inbox/directory loads previously continued to show Loading. They now stop, offer Retry, and retain the last loaded information during a failed refresh.
- Browser checks cover reply, registration and case drafts across in-app refresh and section changes; same-session revalidation; clearing on sign-out and expiry; repeated independent/unselected login questions; exact preview and separate shelter consent; lost-response duplicate retry; decline/wrong-person requester JSON equality; logout/back navigation and offline logout.
- Keyboard checks cover reply opening, exact preview, returning to editing, Cancel, shelter editing, send confirmation and inactivity warning focus. A failed renewal shows an explicit error and keeps the original deadline. A browser-only simulated clock was realigned with server wall time before the successful renewal assertion.
- Review found Cancel/shelter-edit focus loss and stale assistance metadata in retained cases. Both failures were reproduced, fixed, and passed in the final full suite.
- Sign-out hides private content immediately and displays a pending state until the server attempt settles. A delayed-response test verifies handoff cannot begin through the visible UI during this period. Forced full browser navigation can still interrupt logout; the existing lock marker requires revocation on reconnect and may lose the fictional demo workspace.
- Home actions fit 1024×768 without scrolling. Tablet portrait/landscape resident and staff layouts have no horizontal overflow. All four staff task controls remain visible in a wrapping grid at 320px. The directory list precedes the map and remains usable with failed tiles.

Drafts are memory-only. In-app Refresh preserves them; a full browser reload clears them. API routes/response contracts and safeguarding boundaries are unchanged.

### Preview and screenshots

Run `npm run build` then `npm run preview:local` from the working copy. The preview binds only to `127.0.0.1:41938`, uses the existing local fictional `ping` database, and never resets it. The current local dependency directory is a junction to the original project's installed dependencies; a standalone copy can use `npm ci` instead.

- [Live-preview capture](screenshots/preview-live.png)
- [Landscape home](screenshots/home-1024.png) / [portrait home](screenshots/home-768.png) / [320px home](screenshots/home-320.png)
- [Landscape resident](screenshots/resident-1024.png) / [portrait resident](screenshots/resident-768.png) / [send confirmation](screenshots/resident-confirmation.png)
- [Landscape staff](screenshots/staff-1024.png) / [portrait staff](screenshots/staff-768.png) / [320px staff](screenshots/staff-320.png)

### Remaining limits

No current failed automated checks. Physical shared-tablet/iPad keyboard behavior, Safari/iOS, Firefox, screen readers, printing, public deployment, managed TLS/cookies, real hosting behavior and public CI remain **unverified**. Dependency audit was not rerun on October 18. No commit, push or publication was performed; publication remains pending review of the concrete preview.

Windows sandbox initially blocked native esbuild directory access and tsx user lookup. Running the same commands with elevated tool access succeeded; no application workaround was added for these environment errors. Playwright emitted harmless NO_COLOR/FORCE_COLOR warnings.

## October 16 historical checks

Local checks performed October 16, 2026 on Windows, Node 24.16.0, native project-local PostgreSQL 18, and Playwright Chromium. This is not public-deployment verification.

## Observed final local checks

| Check | Observed result |
|---|---|
| `npm run build` | Passed: TypeScript, Vite frontend and bundled Express entry |
| `npm test` | 14 PostgreSQL API tests passed after review fixes |
| `npm run test:e2e` | 7 Chromium scenarios passed after review fixes |
| `npm audit` / dependency install audit | Zero known vulnerabilities after removing unused drizzle-kit tooling |
| Screenshots | Desktop/mobile home, resident reply, failed-map mobile directory generated from the running app |
| Scoped independent AI review | Completed; three findings addressed with failing-then-passing regressions; no second review claimed |
| `npm run db:migrate` | Applied additive migrations to the local interactive database |

## Test coverage

API: database-backed shelter directory; unauthenticated denial; private cross-shelter cycle; exact preview and separate location consent; duplicate reply retry; requester JSON equality across routing/decline/wrong-person; alternate candidate routing; resident/shelter/workspace/CSRF/safeguarding boundaries; assistance cancellation and persistence; missing login preferences; generic login and persistent throttles; registration retry/payload conflict; unknown-age intake; competing routes/claim access; revoked cookies/server idle expiry; reset isolation; disabled demo helpers; duplicate-name fixture isolation.

Browser: complete staff→Jordan→Alex cycle and later location consent; logout/back navigation; desktop and 390px/320px layout checks; failed-map list fallback; shared idle expiry; leading-zero registration/login and code-only card; response lost after backend commit followed by safe retry; offline logout and reconnect; recovering an existing account card after its first fetch fails.

Additional API regressions cover approved-reply assistance for the requester (including separate location updates and cancelling a claim) and a delayed session-store save after logout.

## Failures found and corrected

- Initial workflow tests failed before routes existed, then passed after implementation.
- The exact accessible name of a reply field included its help text. Field labels now use explicit label association and described-by hints. The browser flow passes.
- A custom age selector did not forward its generated label ID. It now forwards accessibility props; registration browser test passes.
- A new resident with a seeded name could overwrite the demo guide's name-based lookup. A failing duplicate-name regression led to a separate migration adding explicit fixture keys; the regression passes.
- Four moderate npm findings came from unused drizzle-kit's old transitive development tooling. Removed the unused generator; Drizzle's checked-in SQL migration runner remains. Audit reports zero findings.
- The first suggested browser-test port was already in use. The suite uses dedicated port 41937 and refuses reuse; the unrelated service was left untouched.
- Independent review found a logout race: a previously loaded session could be saved after deletion. A durable revoked-session record now prevents that old cookie from authenticating, even if a delayed session-store write recreates its row. The reproduction failed before the fix and passes afterward.
- Independent review found assistance only covered incoming requests. Approved replies now queue at the requester's help desk when requested; a later consented shelter update reopens only that response's completed task. Access still requires a valid local claim and exposes only approved content.
- Independent review found successful registration could lose its card when the card fetch failed. The implementer treated this as important for intermittent connectivity, retained the created account, and added both retry and local-case card access. The browser regression first timed out on the missing recovery button, then passed.

## Still unverified

- Public Render/Neon deployment, public repository access, actual GitHub Actions runs, managed TLS/secure-cookie behavior behind Render's proxy, cold-start experience and provider quotas.
- Physical shared tablets, Safari/iOS, Firefox, screen-reader operation, actual printer output, disaster-scale concurrency and long-duration service/database restart exercises.
- No production security certification, user research, legal/clinical safeguarding validation or disaster deployment readiness is claimed.

Automated tests are meaningful boundary checks, not a guarantee against every misuse. All three review findings received a fix pass and fresh local verification. Public deployment and submission remain incomplete.
